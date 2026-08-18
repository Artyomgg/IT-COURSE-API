// server/src/routes/tests.js
const express = require('express')
const router = express.Router()
const Test = require('../models/Test.js')
const Teacher = require('../models/Teacher.js')
const Permission = require('../models/Permission.js')
const { authenticateToken } = require('../middleware/auth.js')

// ============================================
// ✅ СПЕЦИФИЧНЫЕ МАРШРУТЫ (ДОЛЖНЫ БЫТЬ ПЕРВЫМИ!)
// ============================================

// ============ GET /teachers — Публичный список учителей ============
router.get('/teachers', async (req, res) => {
	try {
		const { school, search } = req.query

		let query = { is_active: true }
		if (school) query.school = school

		let teachers = await Teacher.find(query)
			.select('full_name email subject school role')
			.sort('full_name')

		teachers = teachers.filter(t => t.role !== 'super_admin')

		const permissions = await Permission.find({
			user_id: { $in: teachers.map(t => t._id) },
		})

		teachers = teachers.filter(teacher => {
			const perm = permissions.find(p => p.user_id.toString() === teacher._id.toString())
			if (!perm) return true
			if (!perm.permissions) return true
			if (perm.permissions.show_in_test_registration === undefined) return true
			return perm.permissions.show_in_test_registration !== false
		})

		if (search) {
			const searchLower = search.toLowerCase()
			teachers = teachers.filter(
				t =>
					t.full_name.toLowerCase().includes(searchLower) ||
					(t.subject && t.subject.toLowerCase().includes(searchLower)),
			)
		}

		res.json(teachers)
	} catch (err) {
		console.error('❌ Ошибка получения публичных учителей:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ GET /metadata/:sectionId — Получить список тестов для раздела ============
router.get('/metadata/:sectionId', async (req, res) => {
	try {
		const { sectionId } = req.params

		const tests = await Test.find({ sectionId, isActive: true })
			.select('id title description icon duration path questions')
			.sort({ id: 1 })

		const result = tests.map(test => ({
			...test.toObject(),
			questionsCount: test.questions?.length || 0,
		}))

		res.json(result)
	} catch (err) {
		console.error('❌ Ошибка получения метаданных тестов:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============================================
// ✅ ОБЩИЕ МАРШРУТЫ
// ============================================

// ============ GET / — Получить все тесты ============
router.get('/', async (req, res) => {
	try {
		const { sectionId, search } = req.query

		let query = {}

		if (sectionId && sectionId !== 'all') {
			query.sectionId = sectionId
		}
		if (search) {
			query.$or = [
				{ title: { $regex: search, $options: 'i' } },
				{ description: { $regex: search, $options: 'i' } },
			]
		}

		const tests = await Test.find(query).sort({ sectionId: 1, id: 1 }).select('-createdBy')

		res.json(tests)
	} catch (err) {
		console.error('❌ Ошибка получения тестов:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ GET /:id — Получить тест по ID ============
router.get('/:id', async (req, res) => {
	try {
		const { id } = req.params
		const testId = parseInt(id)

		if (isNaN(testId)) {
			return res.status(400).json({ error: 'Неверный ID теста' })
		}

		const test = await Test.findOne({ id: testId, isActive: true }).select('-createdBy')

		if (!test) {
			return res.status(404).json({ error: 'Тест не найден' })
		}

		res.json(test)
	} catch (err) {
		console.error('❌ Ошибка получения теста:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============================================
// 🔒 АДМИНСКИЕ МАРШРУТЫ
// ============================================

// ============ POST / — Создать тест ============
router.post('/', authenticateToken, async (req, res) => {
	try {
		const { id: userId } = req.user
		const { title, description, icon, sectionId, questions, duration } = req.body

		if (!title || !sectionId || !questions || questions.length === 0) {
			return res.status(400).json({ error: 'Название, раздел и вопросы обязательны' })
		}

		const lastTest = await Test.findOne().sort({ id: -1 })
		const newId = lastTest ? lastTest.id + 1 : 1

		const maxScore = questions.reduce((acc, q) => acc + (q.points || 1), 0)

		const test = new Test({
			id: newId,
			title,
			description: description || '',
			icon: icon || '📝',
			sectionId,
			classId: sectionId,
			questions,
			maxScore,
			duration: duration || '20 минут',
			path: `/courses/forschool/${sectionId}/test/${newId}`,
			createdBy: userId,
		})

		await test.save()

		const { createNotification } = require('../utils/notifications.js')
		await createNotification({
			type: 'test_add',
			title: '📝 Добавлен новый тест',
			message: `Добавлен тест: "${title}" для раздела ${sectionId}`,
			details: { testId: test.id, title, sectionId },
			targetRoles: ['all', 'super_admin', 'school_admin', 'teacher'],
			createdBy: userId,
		})

		res.status(201).json(test)
	} catch (err) {
		console.error('❌ Ошибка создания теста:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ PUT /:id — Обновить тест ============
router.put('/:id', authenticateToken, async (req, res) => {
	try {
		const { id } = req.params
		const test = await Test.findOne({ id: parseInt(id) })

		if (!test) {
			return res.status(404).json({ error: 'Тест не найден' })
		}

		const { title, description, icon, sectionId, questions, duration, isActive } = req.body

		if (questions && questions.length > 0) {
			const maxScore = questions.reduce((acc, q) => acc + (q.points || 1), 0)
			test.maxScore = maxScore
			test.questions = questions
		}

		if (title) test.title = title
		if (description !== undefined) test.description = description
		if (icon) test.icon = icon
		if (sectionId) {
			test.sectionId = sectionId
			test.classId = sectionId
			test.path = `/courses/forschool/${sectionId}/test/${test.id}`
		}
		if (duration) test.duration = duration
		if (isActive !== undefined) test.isActive = isActive
		test.updatedAt = new Date()

		await test.save()

		const { createNotification } = require('../utils/notifications.js')
		await createNotification({
			type: 'test_update',
			title: '✏️ Обновлён тест',
			message: `Обновлён тест: "${test.title}" для раздела ${test.sectionId}`,
			details: { testId: test.id, title: test.title, sectionId: test.sectionId },
			targetRoles: ['all', 'super_admin', 'school_admin', 'teacher'],
			createdBy: req.user.id,
		})

		res.json(test)
	} catch (err) {
		console.error('❌ Ошибка обновления теста:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ DELETE /:id — Удалить тест ============
router.delete('/:id', authenticateToken, async (req, res) => {
	try {
		const { id } = req.params
		const test = await Test.findOne({ id: parseInt(id) })

		if (!test) {
			return res.status(404).json({ error: 'Тест не найден' })
		}

		const title = test.title
		const sectionId = test.sectionId

		await Test.findOneAndDelete({ id: parseInt(id) })

		const { createNotification } = require('../utils/notifications.js')
		await createNotification({
			type: 'test_delete',
			title: '🗑️ Удалён тест',
			message: `Удалён тест: "${title}" для раздела ${sectionId}`,
			details: { title, sectionId },
			targetRoles: ['all', 'super_admin', 'school_admin', 'teacher'],
			createdBy: req.user.id,
		})

		res.json({ message: 'Тест удалён' })
	} catch (err) {
		console.error('❌ Ошибка удаления теста:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ POST /import — Импорт тестов ============
router.post('/import', authenticateToken, async (req, res) => {
	try {
		const { id: userId } = req.user
		const { tests, sectionId } = req.body

		if (!tests || !Array.isArray(tests) || tests.length === 0) {
			return res.status(400).json({ error: 'Нужен массив тестов' })
		}

		const imported = []

		for (const testData of tests) {
			const existing = await Test.findOne({ id: testData.id })
			if (existing) {
				existing.title = testData.title
				existing.description = testData.description || ''
				existing.icon = testData.icon || '📝'
				existing.sectionId = sectionId || testData.sectionId || testData.classId
				existing.classId = existing.sectionId
				existing.questions = testData.questions
				existing.duration = testData.duration || '20 минут'
				existing.maxScore = testData.questions.reduce((acc, q) => acc + (q.points || 1), 0)
				existing.path = `/courses/forschool/${existing.sectionId}/test/${existing.id}`
				existing.updatedAt = new Date()
				await existing.save()
				imported.push({ ...existing.toObject(), action: 'updated' })
			} else {
				const targetSectionId = sectionId || testData.sectionId || testData.classId
				const maxScore = testData.questions.reduce((acc, q) => acc + (q.points || 1), 0)
				const test = new Test({
					id: testData.id,
					title: testData.title,
					description: testData.description || '',
					icon: testData.icon || '📝',
					sectionId: targetSectionId,
					classId: targetSectionId,
					questions: testData.questions,
					maxScore,
					duration: testData.duration || '20 минут',
					path: `/courses/forschool/${targetSectionId}/test/${testData.id}`,
					createdBy: userId,
				})
				await test.save()
				imported.push({ ...test.toObject(), action: 'created' })
			}
		}

		const { createNotification } = require('../utils/notifications.js')
		await createNotification({
			type: 'test_import',
			title: '📥 Импорт тестов',
			message: `Импортировано ${imported.length} тестов для раздела ${sectionId || 'разных'}`,
			details: { count: imported.length, sectionId },
			targetRoles: ['all', 'super_admin', 'school_admin', 'teacher'],
			createdBy: userId,
		})

		res.json({
			message: `Импортировано ${imported.length} тестов`,
			imported,
		})
	} catch (err) {
		console.error('❌ Ошибка импорта тестов:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

module.exports = router
