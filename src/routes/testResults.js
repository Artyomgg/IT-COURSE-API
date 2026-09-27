// server/src/routes/testResults.js
const express = require('express')
const router = express.Router()
const TestResult = require('../models/TestResult.js')
const { authenticateToken } = require('../middleware/auth.js')

// ============================================
// ✅ ПУБЛИЧНЫЕ МАРШРУТЫ
// ============================================

// ============ POST / — Создать результат ============
router.post('/', async (req, res) => {
	try {
		const resultData = req.body

		if (!resultData.created_at) {
			resultData.created_at = new Date()
		}

		const result = new TestResult(resultData)
		await result.save()

		res.status(201).json(result)
	} catch (err) {
		console.error('❌ Ошибка сохранения результата:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ GET /students — Ученики (ПУБЛИЧНЫЙ, для подсказок) ============
// Можно фильтровать только по школе, класс не обязателен
router.get('/students', async (req, res) => {
	try {
		const { school, teacher } = req.query

		const query = {}
		if (school) query.school = school
		if (teacher) query.teacher_name = teacher

		const results = await TestResult.find(query).select(
			'student_first_name student_last_name student_class',
		)

		// Уникальные по нормализованному ФИО
		const seen = new Set()
		const uniqueStudents = []
		results.forEach(r => {
			if (!r.student_first_name || !r.student_last_name) return
			const key = `${r.student_last_name}_${r.student_first_name}`
				.toLowerCase()
				.replace(/\s+/g, ' ')
				.trim()
			if (!seen.has(key)) {
				seen.add(key)
				uniqueStudents.push({
					first_name: r.student_first_name,
					last_name: r.student_last_name,
					class: r.student_class || '',
				})
			}
		})

		res.json(uniqueStudents)
	} catch (err) {
		console.error('❌ Ошибка получения учеников:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============================================
// 🔒 АДМИНСКИЕ МАРШРУТЫ
// ============================================

// ============ GET / — Получить результаты (С ФИЛЬТРАЦИЕЙ ПО РОЛИ) ============
router.get('/', authenticateToken, async (req, res) => {
	try {
		const { class: classFilter, testId, student, dateFrom, dateTo, testTitle } = req.query

		let query = {}

		// 🔥 ФИЛЬТРАЦИЯ ПО РОЛИ
		if (req.user.role === 'teacher') {
			query.teacher_id = String(req.user.id)
		} else if (req.user.role === 'school_admin') {
			if (req.user.school) {
				query.school = req.user.school
			}
		}

		// Дополнительные фильтры
		if (classFilter) query.student_class = classFilter
		if (testId) query.test_id = parseInt(testId)
		if (testTitle) query.test_title = { $regex: testTitle, $options: 'i' }
		if (student) {
			query.$or = [
				{ student_first_name: { $regex: student, $options: 'i' } },
				{ student_last_name: { $regex: student, $options: 'i' } },
			]
		}
		if (dateFrom || dateTo) {
			query.created_at = {}
			if (dateFrom) query.created_at.$gte = new Date(dateFrom)
			if (dateTo) query.created_at.$lte = new Date(dateTo + 'T23:59:59')
		}

		const results = await TestResult.find(query).sort({ created_at: -1 })

		res.json(results)
	} catch (err) {
		console.error('❌ Ошибка получения результатов:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ POST /batch ============
router.post('/batch', authenticateToken, async (req, res) => {
	try {
		const { results } = req.body

		if (!results || !Array.isArray(results) || results.length === 0) {
			return res.status(400).json({ error: 'Нужен массив результатов' })
		}

		const saved = await TestResult.insertMany(results)
		res.status(201).json(saved)
	} catch (err) {
		console.error('❌ Ошибка массового сохранения:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ DELETE /:id ============
router.delete('/:id', authenticateToken, async (req, res) => {
	try {
		const { id } = req.params

		const result = await TestResult.findById(id)
		if (!result) {
			return res.status(404).json({ error: 'Результат не найден' })
		}

		if (req.user.role === 'teacher' && result.teacher_id !== String(req.user.id)) {
			return res.status(403).json({ error: 'Нет прав на удаление' })
		}
		if (req.user.role === 'school_admin' && req.user.school && result.school !== req.user.school) {
			return res.status(403).json({ error: 'Нет прав на удаление' })
		}

		await TestResult.findByIdAndDelete(id)
		res.json({ message: 'Результат удалён' })
	} catch (err) {
		console.error('❌ Ошибка удаления:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ GET /metadata ============
router.get('/metadata', authenticateToken, async (req, res) => {
	try {
		let query = {}

		if (req.user.role === 'teacher') {
			query.teacher_id = String(req.user.id)
		} else if (req.user.role === 'school_admin') {
			if (req.user.school) query.school = req.user.school
		}

		const results = await TestResult.find(query)

		const uniqueClasses = [...new Set(results.map(r => r.student_class).filter(Boolean))].sort()
		const uniqueTests = [...new Set(results.map(r => r.test_id).filter(Boolean))].sort(
			(a, b) => a - b,
		)
		const uniqueTestTitles = [...new Set(results.map(r => r.test_title).filter(Boolean))].sort()
		const uniqueTeachers = [...new Set(results.map(r => r.teacher_name).filter(Boolean))].sort()

		res.json({
			uniqueClasses,
			uniqueTests: uniqueTests.map(id => ({ id, title: `Тест #${id}` })),
			uniqueTestTitles,
			uniqueTeachers,
		})
	} catch (err) {
		console.error('❌ Ошибка метаданных:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ DELETE /clean ============
router.delete('/clean', authenticateToken, async (req, res) => {
	try {
		const { maxRecords = 10000, maxAgeDays = 180 } = req.query

		const cutoffDate = new Date()
		cutoffDate.setDate(cutoffDate.getDate() - parseInt(maxAgeDays))

		const count = await TestResult.countDocuments()

		if (count <= parseInt(maxRecords)) {
			return res.json({ message: 'Очистка не требуется', deleted: 0, total: count })
		}

		const toDelete = count - parseInt(maxRecords)
		const oldResults = await TestResult.find({ created_at: { $lt: cutoffDate } })
			.sort({ created_at: 1 })
			.limit(toDelete)

		const ids = oldResults.map(r => r._id)
		const result = await TestResult.deleteMany({ _id: { $in: ids } })

		res.json({
			message: 'Очистка выполнена',
			deleted: result.deletedCount,
			total: count - result.deletedCount,
		})
	} catch (err) {
		console.error('❌ Ошибка очистки:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

module.exports = router
