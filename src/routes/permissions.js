// server/src/routes/permissions.js
const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const Permission = require('../models/Permission.js')
const Teacher = require('../models/Teacher.js')
const { authenticateToken } = require('../middleware/auth.js')

// ============ GET /list — Получить список пользователей с правами ============
router.get('/list', authenticateToken, async (req, res) => {
	try {
		const { role, school } = req.user

		if (role !== 'super_admin' && role !== 'school_admin') {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		const query = role === 'super_admin' ? {} : { school }

		const teachers = await Teacher.find(query).select(
			'full_name email username role is_active school avatar',
		)

		const permissions = await Permission.find({
			user_id: { $in: teachers.map(t => t._id) },
		})

		const result = teachers.map(teacher => {
			const perm = permissions.find(p => p.user_id.toString() === teacher._id.toString())
			return {
				...teacher.toObject(),
				permissions: perm ? perm.permissions : null,
				has_permissions: !!perm,
			}
		})

		res.json(result)
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ GET /:userId — Получить права пользователя ============
router.get('/:userId', authenticateToken, async (req, res) => {
	try {
		const { userId } = req.params
		const { role, school, id: currentUserId } = req.user

		// ✅ Если пользователь запрашивает свои права — разрешаем
		if (userId !== currentUserId) {
			// Если запрашивает чужие права — только super_admin и school_admin
			if (role !== 'super_admin' && role !== 'school_admin') {
				return res.status(403).json({ error: 'Недостаточно прав' })
			}
		}

		if (!mongoose.Types.ObjectId.isValid(userId)) {
			return res.status(400).json({ error: 'Неверный ID пользователя' })
		}

		const targetUser = await Teacher.findById(userId)
		if (!targetUser) {
			return res.status(404).json({ error: 'Пользователь не найден' })
		}

		// Если школьный админ запрашивает права учителя не из своей школы
		if (role === 'school_admin' && targetUser.school !== school && userId !== currentUserId) {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		let permissions = await Permission.findOne({ user_id: userId })

		if (!permissions) {
			const defaultPermissions = {
				user_id: userId,
				permissions: {
					manage_bitcraft: false,
					view_bitcraft: true,
					manage_tests: false,
					view_tests: true, // ✅ По умолчанию true для всех
					view_test_results: false,
					export_test_results: false,
					view_teachers: false,
					manage_teachers: false,
					edit_teachers: false,
					delete_teachers: false,
					reset_teacher_password: false,
					view_profile: true,
					edit_profile: true,
					change_password: true,
					view_notifications: true,
					is_school_admin: false,
					show_in_test_registration: true,
				},
			}
			permissions = await Permission.create(defaultPermissions)
		}

		res.json(permissions)
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ PUT /:userId — Обновить права пользователя ============
router.put('/:userId', authenticateToken, async (req, res) => {
	try {
		const { userId } = req.params
		const { role, school } = req.user
		const { permissions } = req.body

		if (role !== 'super_admin' && role !== 'school_admin') {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		if (!mongoose.Types.ObjectId.isValid(userId)) {
			return res.status(400).json({ error: 'Неверный ID пользователя' })
		}

		const targetUser = await Teacher.findById(userId)
		if (!targetUser) {
			return res.status(404).json({ error: 'Пользователь не найден' })
		}

		if (role === 'school_admin') {
			if (targetUser.school !== school) {
				return res.status(403).json({ error: 'Недостаточно прав' })
			}
			if (targetUser.role === 'super_admin' || targetUser.role === 'school_admin') {
				return res.status(403).json({ error: 'Нельзя менять права администратора' })
			}
		}

		// Для super_admin принудительно скрываем из регистрации
		if (targetUser.role === 'super_admin') {
			permissions.show_in_test_registration = false
		}

		const updated = await Permission.findOneAndUpdate(
			{ user_id: userId },
			{
				$set: {
					permissions: permissions,
					updated_at: new Date(),
				},
			},
			{ returnDocument: 'after', upsert: true },
		)

		if (permissions.is_school_admin && targetUser.role !== 'super_admin') {
			targetUser.role = 'school_admin'
			await targetUser.save()
		} else if (!permissions.is_school_admin && targetUser.role === 'school_admin') {
			targetUser.role = 'teacher'
			await targetUser.save()
		}

		res.json(updated)
	} catch (err) {
		console.error('❌ Ошибка обновления прав:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

module.exports = router
