// server/src/scripts/autoClean.js
require('dotenv').config({ path: '../../.env' })
const mongoose = require('mongoose')
const TestResult = require('../models/TestResult.js')

const MONGODB_URI = process.env.MONGODB_URI

const CONFIG = {
	// Максимальное количество записей
	MAX_RECORDS: 10000,
	// Удалять записи старше 6 месяцев (180 дней)
	MAX_AGE_DAYS: 180,
}

async function autoClean() {
	try {
		await mongoose.connect(MONGODB_URI)
		console.log(`\n[${new Date().toISOString()}] ✅ Подключено к MongoDB`)
		console.log(`[${new Date().toISOString()}] 📋 Конфигурация:`)
		console.log(`   - Максимум записей: ${CONFIG.MAX_RECORDS}`)
		console.log(`   - Максимальный возраст: ${CONFIG.MAX_AGE_DAYS} дней\n`)

		const total = await TestResult.countDocuments()
		console.log(`[${new Date().toISOString()}] 📊 Всего записей: ${total}`)

		let deletedTotal = 0
		let remaining = total

		// ========== 1. Удаляем старые записи (по возрасту) ==========
		const cutoffDate = new Date()
		cutoffDate.setDate(cutoffDate.getDate() - CONFIG.MAX_AGE_DAYS)

		const oldResults = await TestResult.find({
			created_at: { $lt: cutoffDate },
		}).select('_id created_at')

		if (oldResults.length > 0) {
			const oldIds = oldResults.map(doc => doc._id)
			const oldestDate = oldResults[oldResults.length - 1]?.created_at

			console.log(
				`[${new Date().toISOString()}] 📅 Найдено старых записей (старше ${CONFIG.MAX_AGE_DAYS} дней): ${oldResults.length}`,
			)
			console.log(
				`   Самая старая: ${oldestDate ? new Date(oldestDate).toLocaleDateString() : 'неизвестно'}`,
			)
			console.log(`   Граничная дата: ${cutoffDate.toLocaleDateString()}`)

			const result1 = await TestResult.deleteMany({
				_id: { $in: oldIds },
			})

			deletedTotal += result1.deletedCount
			remaining = await TestResult.countDocuments()
			console.log(`   ✅ Удалено по возрасту: ${result1.deletedCount} записей`)
			console.log(`   📊 Осталось: ${remaining}`)
		} else {
			console.log(`[${new Date().toISOString()}] ✅ Нет записей старше ${CONFIG.MAX_AGE_DAYS} дней`)
		}

		// ========== 2. Если всё ещё больше лимита — удаляем самые старые ==========
		const currentTotal = await TestResult.countDocuments()

		if (currentTotal > CONFIG.MAX_RECORDS) {
			const toDelete = currentTotal - CONFIG.MAX_RECORDS
			console.log(
				`\n[${new Date().toISOString()}] ⚠️ Превышен лимит (${currentTotal} > ${CONFIG.MAX_RECORDS})`,
			)
			console.log(`   Нужно удалить: ${toDelete} записей`)

			// Находим самые старые записи (не трогаем последние MAX_RECORDS)
			const oldestToDelete = await TestResult.find()
				.sort({ created_at: 1 }) // Сначала самые старые
				.limit(toDelete)
				.select('_id created_at')

			if (oldestToDelete.length > 0) {
				const ids = oldestToDelete.map(doc => doc._id)
				const oldestDate = oldestToDelete[0]?.created_at
				const newestDate = oldestToDelete[oldestToDelete.length - 1]?.created_at

				console.log(
					`   Удаляются записи от ${new Date(oldestDate).toLocaleDateString()} до ${new Date(newestDate).toLocaleDateString()}`,
				)

				const result2 = await TestResult.deleteMany({
					_id: { $in: ids },
				})

				deletedTotal += result2.deletedCount
				remaining = await TestResult.countDocuments()
				console.log(`   ✅ Удалено по лимиту: ${result2.deletedCount} записей`)
			}
		} else {
			console.log(
				`\n[${new Date().toISOString()}] ✅ Количество записей (${currentTotal}) в пределах лимита (${CONFIG.MAX_RECORDS})`,
			)
		}

		// ========== Итог ==========
		console.log(`\n[${new Date().toISOString()}] 🎉 Очистка завершена!`)
		console.log(`   ✅ Всего удалено: ${deletedTotal} записей`)
		console.log(`   📊 Осталось: ${await TestResult.countDocuments()} записей`)

		await mongoose.connection.close()
		console.log(`[${new Date().toISOString()}] 🔌 Соединение закрыто\n`)
	} catch (err) {
		console.error(`[${new Date().toISOString()}] ❌ Ошибка:`, err)
		await mongoose.connection.close()
		process.exit(1)
	}
}

autoClean()
