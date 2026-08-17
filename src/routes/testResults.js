// server/src/routes/testResults.js
const express = require('express')
const router = express.Router()
const TestResult = require('../models/TestResult.js')
const Permission = require('../models/Permission.js')
const Teacher = require('../models/Teacher.js')
const { authenticateToken } = require('../middleware/auth.js')

// ============ Вспомогательная функция: проверка прав ============
async function hasPermission(userId, permissionKey) {
	try {
		const perm = await Permission.findOne({ user_id: userId })
		if (!perm) return false
		return perm.permissions?.[permissionKey] === true
	} catch (err) {
		return false
	}
}

// ============ Вспомогательная функция: получить учителей школы ============
async function getTeacherIdsBySchool(school) {
	try {
		const teachers = await Teacher.find({ school }).select('_id')
		return teachers.map(t => t._id.toString())
	} catch (err) {
		console.error('Ошибка получения учителей:', err)
		return []
	}
}

// ============ GET / — Получить результаты тестов ============
router.get('/', authenticateToken, async (req, res) => {
	try {
		const { role, id: userId, school } = req.user
		const {
			class: classFilter,
			testId,
			student,
			dateFrom,
			dateTo,
			testTitle,
			teacherId,
			school: schoolFilter,
		} = req.query

		let query = {}

		// ===== ПРОВЕРКА ПРАВ =====
		if (role === 'teacher') {
			query.teacher_id = userId
		} else if (role === 'school_admin') {
			const canView = await hasPermission(userId, 'view_test_results')
			if (!canView) {
				return res.status(403).json({
					error: 'У вас нет прав на просмотр результатов тестов',
					code: 'PERMISSION_DENIED',
				})
			}
			query.$or = [{ school: school }, { teacher_id: { $in: await getTeacherIdsBySchool(school) } }]
		} else if (role === 'super_admin') {
			if (schoolFilter) {
				query.school = schoolFilter
			}
		}

		// ===== ДОПОЛНИТЕЛЬНЫЕ ФИЛЬТРЫ =====
		if (classFilter) query.student_class = classFilter
		if (testId) query.test_id = parseInt(testId)
		if (student) {
			query.$or = [
				{ student_last_name: { $regex: student, $options: 'i' } },
				{ student_first_name: { $regex: student, $options: 'i' } },
			]
		}
		if (testTitle) query.test_title = { $regex: testTitle, $options: 'i' }
		if (dateFrom || dateTo) {
			query.created_at = {}
			if (dateFrom) query.created_at.$gte = new Date(dateFrom)
			if (dateTo) query.created_at.$lte = new Date(dateTo + 'T23:59:59')
		}
		if (teacherId) query.teacher_id = teacherId

		const results = await TestResult.find(query).sort({ created_at: -1 }).limit(1000)
		res.json(results)
	} catch (err) {
		console.error('❌ Ошибка получения результатов:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ GET /metadata — Получить метаданные ============
router.get('/metadata', authenticateToken, async (req, res) => {
	try {
		const { role, id: userId, school } = req.user

		let query = {}

		if (role === 'teacher') {
			query.teacher_id = userId
		} else if (role === 'school_admin') {
			const canView = await hasPermission(userId, 'view_test_results')
			if (!canView) {
				return res.status(403).json({
					error: 'У вас нет прав на просмотр результатов тестов',
					code: 'PERMISSION_DENIED',
				})
			}
			query.$or = [{ school: school }, { teacher_id: { $in: await getTeacherIdsBySchool(school) } }]
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
		console.error('Ошибка получения метаданных:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ DELETE /:id — Удалить результат ============
router.delete('/:id', authenticateToken, async (req, res) => {
	try {
		const { role, id: userId, school } = req.user
		const resultId = req.params.id

		// Находим результат
		const result = await TestResult.findById(resultId)
		if (!result) {
			return res.status(404).json({ error: 'Результат не найден' })
		}

		// ===== ПРОВЕРКА ПРАВ НА УДАЛЕНИЕ =====
		let canDelete = false

		if (role === 'super_admin') {
			canDelete = true
		} else if (role === 'school_admin') {
			// Проверяем, что результат принадлежит школе админа
			if (result.school === school) {
				canDelete = true
			}
			// Или проверяем через teacher_id
			const teacherIds = await getTeacherIdsBySchool(school)
			if (teacherIds.includes(result.teacher_id)) {
				canDelete = true
			}
		} else if (role === 'teacher') {
			// Учитель может удалять только свои результаты
			if (result.teacher_id === userId) {
				canDelete = true
			}
		}

		if (!canDelete) {
			return res.status(403).json({
				error: 'У вас нет прав на удаление этого результата',
				code: 'PERMISSION_DENIED',
			})
		}

		await TestResult.findByIdAndDelete(resultId)
		res.json({ message: 'Результат удалён' })
	} catch (err) {
		console.error('❌ Ошибка удаления результата:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

module.exports = router
