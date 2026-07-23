// server/src/routes/testResults.js
const express = require('express')
const router = express.Router()
const TestResult = require('../models/TestResult.js')
const Teacher = require('../models/Teacher.js')
const { authenticateToken } = require('../middleware/auth.js')

// ============ GET / — Получить результаты ============
router.get('/', authenticateToken, async (req, res) => {
	try {
		const { role, id, school } = req.user
		let query = {}

		if (role === 'teacher') {
			// Учитель видит только свои результаты (по teacher_id)
			query = { teacher_id: id }
		} else if (role === 'super_admin') {
			// Супер-админ видит результаты всех учителей своей школы
			const teachers = await Teacher.find({ school }).select('_id')
			const teacherIds = teachers.map(t => t._id.toString())
			query = { teacher_id: { $in: teacherIds } }
		}

		// Фильтры из query параметров
		const { class: className, testId, student, dateFrom, dateTo, testTitle } = req.query

		if (className) query.student_class = className
		if (testId) query.test_id = parseInt(testId)
		if (testTitle) {
			query.test_title = { $regex: testTitle, $options: 'i' }
		}
		if (student) {
			query.$or = [
				{ student_last_name: { $regex: student, $options: 'i' } },
				{ student_first_name: { $regex: student, $options: 'i' } },
			]
		}
		if (dateFrom) {
			const fromDate = new Date(dateFrom)
			fromDate.setHours(0, 0, 0, 0)
			query.created_at = { $gte: fromDate }
		}
		if (dateTo) {
			const toDate = new Date(dateTo)
			toDate.setHours(23, 59, 59, 999)
			query.created_at = { ...query.created_at, $lte: toDate }
		}

		const results = await TestResult.find(query).sort('-created_at')
		res.json(results)
	} catch (err) {
		console.error('❌ Ошибка получения результатов:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ POST / — Добавить результат ============
router.post('/', authenticateToken, async (req, res) => {
	try {
		const { id: teacherId, school } = req.user
		const data = req.body

		// Проверяем обязательные поля
		const required = [
			'student_last_name',
			'student_first_name',
			'student_class',
			'test_id',
			'test_title',
			'score',
			'max_score',
			'grade',
			'percentage',
		]
		for (const field of required) {
			if (!data[field] && data[field] !== 0) {
				return res.status(400).json({ error: `Поле ${field} обязательно` })
			}
		}

		// Создаём результат
		const result = new TestResult({
			...data,
			teacher_id: teacherId,
			school: school || data.school || '',
			answers: data.answers || {},
		})

		await result.save()
		console.log('✅ Результат сохранён:', result._id)
		res.status(201).json(result)
	} catch (err) {
		console.error('❌ Ошибка сохранения результата:', err)
		res.status(500).json({ error: 'Ошибка сохранения результата' })
	}
})

// ============ POST /batch — Добавить несколько результатов ============
router.post('/batch', authenticateToken, async (req, res) => {
	try {
		const { id: teacherId, school } = req.user
		const results = req.body

		if (!Array.isArray(results) || results.length === 0) {
			return res.status(400).json({ error: 'Нужен массив результатов' })
		}

		const saved = await TestResult.insertMany(
			results.map(r => ({ ...r, teacher_id: teacherId, school: school || r.school || '' })),
		)

		console.log(`✅ Сохранено ${saved.length} результатов`)
		res.status(201).json(saved)
	} catch (err) {
		console.error('❌ Ошибка сохранения результатов:', err)
		res.status(500).json({ error: 'Ошибка сохранения результатов' })
	}
})

// ============ DELETE /:id — Удалить результат ============
router.delete('/:id', authenticateToken, async (req, res) => {
	try {
		const { id: userId, role, school } = req.user
		const resultId = req.params.id

		const result = await TestResult.findById(resultId)
		if (!result) {
			return res.status(404).json({ error: 'Результат не найден' })
		}

		// Проверка прав
		if (role === 'teacher' && result.teacher_id !== userId) {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}
		if (role === 'super_admin') {
			// Проверяем, что результат принадлежит учителю из школы админа
			const teacher = await Teacher.findById(result.teacher_id)
			if (teacher && teacher.school !== school) {
				return res.status(403).json({ error: 'Недостаточно прав' })
			}
		}

		await TestResult.findByIdAndDelete(resultId)
		console.log('🗑️ Результат удалён:', resultId)
		res.json({ message: 'Результат удалён' })
	} catch (err) {
		console.error('❌ Ошибка удаления:', err)
		res.status(500).json({ error: 'Ошибка удаления' })
	}
})

// ============ GET /metadata — Получить метаданные для фильтров ============
router.get('/metadata', authenticateToken, async (req, res) => {
	try {
		const { role, id, school } = req.user
		let query = {}

		if (role === 'teacher') {
			query = { teacher_id: id }
		} else if (role === 'super_admin') {
			const teachers = await Teacher.find({ school }).select('_id')
			const teacherIds = teachers.map(t => t._id.toString())
			query = { teacher_id: { $in: teacherIds } }
		}

		const [classes, tests, titles] = await Promise.all([
			TestResult.distinct('student_class', query),
			TestResult.distinct('test_id', query),
			TestResult.distinct('test_title', query),
		])

		res.json({
			uniqueClasses: classes.filter(Boolean).sort(),
			uniqueTests: tests.filter(Boolean).sort(),
			uniqueTestTitles: titles.filter(Boolean).sort(),
		})
	} catch (err) {
		console.error('❌ Ошибка получения метаданных:', err)
		res.status(500).json({ error: 'Ошибка получения метаданных' })
	}
})

// ============ GET /stats — Получить статистику ============
router.get('/stats', authenticateToken, async (req, res) => {
	try {
		const { role, id, school } = req.user
		let query = {}

		if (role === 'teacher') {
			query = { teacher_id: id }
		} else if (role === 'super_admin') {
			const teachers = await Teacher.find({ school }).select('_id')
			const teacherIds = teachers.map(t => t._id.toString())
			query = { teacher_id: { $in: teacherIds } }
		}

		const results = await TestResult.find(query)

		const total = results.length
		const avgGrade =
			total > 0 ? (results.reduce((acc, r) => acc + r.grade, 0) / total).toFixed(1) : 0
		const avgPercentage =
			total > 0 ? (results.reduce((acc, r) => acc + r.percentage, 0) / total).toFixed(1) : 0
		const emailsSent = results.filter(r => r.email_sent).length

		res.json({
			total,
			averageGrade: avgGrade,
			averagePercentage: avgPercentage,
			emailsSent,
		})
	} catch (err) {
		console.error('❌ Ошибка получения статистики:', err)
		res.status(500).json({ error: 'Ошибка получения статистики' })
	}
})

// ============ DELETE /clean — Очистка старых результатов ============
router.delete('/clean', authenticateToken, async (req, res) => {
	try {
		const { role } = req.user

		if (role !== 'super_admin') {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		const MAX_RECORDS = parseInt(req.query.maxRecords) || 10000
		const MAX_AGE_DAYS = parseInt(req.query.maxAgeDays) || 180

		let deletedTotal = 0
		let deletedByAge = 0
		let deletedByLimit = 0

		// ========== 1. Удаляем по возрасту ==========
		const cutoffDate = new Date()
		cutoffDate.setDate(cutoffDate.getDate() - MAX_AGE_DAYS)

		const oldResults = await TestResult.find({
			created_at: { $lt: cutoffDate },
		}).select('_id')

		if (oldResults.length > 0) {
			const oldIds = oldResults.map(doc => doc._id)
			const result1 = await TestResult.deleteMany({ _id: { $in: oldIds } })
			deletedByAge = result1.deletedCount
			deletedTotal += deletedByAge
		}

		// ========== 2. Проверяем лимит ==========
		const currentTotal = await TestResult.countDocuments()

		if (currentTotal > MAX_RECORDS) {
			const toDelete = currentTotal - MAX_RECORDS

			const oldestToDelete = await TestResult.find()
				.sort({ created_at: 1 })
				.limit(toDelete)
				.select('_id')

			if (oldestToDelete.length > 0) {
				const ids = oldestToDelete.map(doc => doc._id)
				const result2 = await TestResult.deleteMany({ _id: { $in: ids } })
				deletedByLimit = result2.deletedCount
				deletedTotal += deletedByLimit
			}
		}

		const remaining = await TestResult.countDocuments()

		res.json({
			message: `Очищено ${deletedTotal} записей`,
			deleted: deletedTotal,
			deletedByAge: deletedByAge,
			deletedByLimit: deletedByLimit,
			remaining: remaining,
			maxRecords: MAX_RECORDS,
			maxAgeDays: MAX_AGE_DAYS,
		})
	} catch (err) {
		console.error('❌ Ошибка очистки:', err)
		res.status(500).json({ error: 'Ошибка очистки' })
	}
})

module.exports = router
