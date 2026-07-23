const express = require('express')
const router = express.Router()
const Teacher = require('../models/Teacher.js')
const TeacherSchedule = require('../models/TeacherSchedule.js')
const { authenticateToken } = require('../middleware/auth.js')

// Генерация случайного пароля
const generateRandomPassword = (length = 12) => {
	const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
	return Array.from({ length }, () =>
		charset.charAt(Math.floor(Math.random() * charset.length)),
	).join('')
}

// ============ GET / — Получить список учителей ============
router.get('/', authenticateToken, async (req, res) => {
	try {
		const { role, id } = req.user
		let query = {}

		if (role === 'teacher') {
			query = { _id: id }
		} else if (role === 'super_admin') {
			query = {} // ✅ Все учителя из всех школ
		}

		const teachers = await Teacher.find(query).select('-password').sort('-created_at')
		res.json(teachers)
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ PUT /:id — Обновить учителя ============
router.put('/:id', authenticateToken, async (req, res) => {
	try {
		const targetId = req.params.id
		const { role, id: currentUserId } = req.user

		const targetTeacher = await Teacher.findById(targetId)
		if (!targetTeacher) return res.status(404).json({ error: 'Учитель не найден' })

		if (role === 'teacher' && targetId !== currentUserId) {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}
		if (role === 'super_admin') {
			// ✅ Супер-админ может редактировать любого учителя (кроме других админов)
			if (targetTeacher.role === 'super_admin' && targetId !== currentUserId) {
				return res.status(403).json({ error: 'Нельзя редактировать другого администратора' })
			}
		}

		const { full_name, username, phone, school: newSchool, subject } = req.body
		const update = { full_name, username, phone, school: newSchool, subject }

		const updated = await Teacher.findByIdAndUpdate(targetId, update, { returnDocument: 'after' }).select(
			'-password',
		)
		res.json(updated)
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ DELETE /:id — Удалить учителя ============
router.delete('/:id', authenticateToken, async (req, res) => {
	try {
		const targetId = req.params.id
		const { role, id: currentUserId } = req.user

		const targetTeacher = await Teacher.findById(targetId)
		if (!targetTeacher) return res.status(404).json({ error: 'Учитель не найден' })

		if (role !== 'super_admin') {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		// ✅ Супер-админ может удалить любого учителя (кроме себя и других админов)
		if (targetTeacher.role === 'super_admin' || targetId === currentUserId) {
			return res.status(403).json({ error: 'Нельзя удалить администратора или самого себя' })
		}

		await TeacherSchedule.deleteMany({ teacher_id: targetId })
		await Teacher.findByIdAndDelete(targetId)

		res.json({ message: 'Учитель удален' })
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ PATCH /:id/toggle-active — Переключить активность ============
router.patch('/:id/toggle-active', authenticateToken, async (req, res) => {
	try {
		const targetId = req.params.id
		const { role, id: currentUserId } = req.user

		const targetTeacher = await Teacher.findById(targetId)
		if (!targetTeacher) return res.status(404).json({ error: 'Учитель не найден' })

		if (role === 'teacher' && targetId !== currentUserId) {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}
		if (role === 'super_admin') {
			// ✅ Супер-админ может менять статус любого учителя (кроме других админов)
			if (targetTeacher.role === 'super_admin' && targetId !== currentUserId) {
				return res.status(403).json({ error: 'Нельзя менять статус другого администратора' })
			}
		}

		targetTeacher.is_active = !targetTeacher.is_active
		await targetTeacher.save()
		res.json({ is_active: targetTeacher.is_active })
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ POST /:id/reset-password — Сброс пароля ============
router.post('/:id/reset-password', authenticateToken, async (req, res) => {
	try {
		const targetId = req.params.id
		const { role, id: currentUserId } = req.user

		const targetTeacher = await Teacher.findById(targetId)
		if (!targetTeacher) return res.status(404).json({ error: 'Учитель не найден' })

		if (role === 'teacher' && targetId !== currentUserId) {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}
		// ✅ Супер-админ может сбросить пароль любому учителю

		const newPassword = generateRandomPassword(12)
		targetTeacher.password = newPassword
		await targetTeacher.save()

		res.json({ newPassword })
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

module.exports = router
