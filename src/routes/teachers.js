// server/src/routes/teachers.js
const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const Teacher = require('../models/Teacher.js')
const { authenticateToken } = require('../middleware/auth.js')
const { uploadAvatar, deleteAvatar } = require('../utils/cloudinary.js')
const { createNotification } = require('../utils/notifications.js')

const generateRandomPassword = (length = 12) => {
	const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
	return Array.from({ length }, () =>
		charset.charAt(Math.floor(Math.random() * charset.length)),
	).join('')
}

// ============ GET / — Получить список учителей ============
router.get('/', authenticateToken, async (req, res) => {
	try {
		const { role, school, id } = req.user
		const { forRegistration } = req.query

		let query = {}

		if (role === 'teacher') {
			query = { _id: id }
		} else if (role === 'school_admin') {
			query = { school: school }
		} else if (role === 'super_admin') {
			query = {}
		}

		let teachers = await Teacher.find(query).select('-password').sort('-created_at')

		// Если запрос для регистрации — фильтруем
		if (forRegistration === 'true') {
			const Permission = require('../models/Permission.js')

			// Получаем всех учителей с правами
			const permissions = await Permission.find({
				user_id: { $in: teachers.map(t => t._id) },
			})

			// Фильтруем:
			// 1. super_admin — НЕ показываем (они не учителя)
			// 2. school_admin — показываем только если show_in_test_registration !== false
			// 3. teacher — показываем только если show_in_test_registration !== false
			teachers = teachers.filter(teacher => {
				// Супер-администраторов НЕ показываем в регистрации
				if (teacher.role === 'super_admin') return false

				const perm = permissions.find(p => p.user_id.toString() === teacher._id.toString())
				// Если прав нет — показываем (по умолчанию true)
				if (!perm) return true
				// Если есть права — проверяем флаг
				return perm.permissions?.show_in_test_registration !== false
			})
		}

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
		const { role, school, id: currentUserId } = req.user

		const targetTeacher = await Teacher.findById(targetId)
		if (!targetTeacher) return res.status(404).json({ error: 'Учитель не найден' })

		if (role === 'teacher' && targetId !== currentUserId) {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}
		if (role === 'school_admin') {
			if (targetTeacher.school !== school) {
				return res.status(403).json({ error: 'Недостаточно прав' })
			}
			if (targetTeacher.role === 'super_admin' || targetTeacher.role === 'school_admin') {
				return res.status(403).json({ error: 'Нельзя редактировать администратора' })
			}
		}
		if (role === 'super_admin') {
			if (targetTeacher.role === 'super_admin' && targetId !== currentUserId) {
				return res.status(403).json({ error: 'Нельзя редактировать другого супер-админа' })
			}
		}

		const { full_name, username, phone, school: newSchool, subject, avatar } = req.body

		let avatarUrl = targetTeacher.avatar || ''

		if (avatar && avatar.startsWith('data:image')) {
			if (targetTeacher.avatar) {
				await deleteAvatar(targetId)
			}
			avatarUrl = await uploadAvatar(avatar, targetId)
		} else if (avatar === '') {
			if (targetTeacher.avatar) {
				await deleteAvatar(targetId)
			}
			avatarUrl = ''
		}

		const update = {
			full_name,
			username,
			phone,
			school: newSchool,
			subject,
			avatar: avatarUrl,
		}

		const updated = await Teacher.findByIdAndUpdate(targetId, update, {
			returnDocument: 'after',
		}).select('-password')
		res.json(updated)
	} catch (err) {
		console.error('❌ Ошибка обновления:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ DELETE /:id — Удалить учителя ============
router.delete('/:id', authenticateToken, async (req, res) => {
	try {
		const targetId = req.params.id
		const { role, school, id: currentUserId } = req.user

		const targetTeacher = await Teacher.findById(targetId)
		if (!targetTeacher) return res.status(404).json({ error: 'Учитель не найден' })

		if (role === 'school_admin') {
			if (targetTeacher.school !== school) {
				return res.status(403).json({ error: 'Недостаточно прав' })
			}
			if (targetTeacher.role === 'super_admin' || targetTeacher.role === 'school_admin') {
				return res.status(403).json({ error: 'Нельзя удалять администратора' })
			}
			if (targetId === currentUserId) {
				return res.status(403).json({ error: 'Нельзя удалить самого себя' })
			}
		}
		if (role === 'super_admin') {
			if (targetTeacher.role === 'super_admin' || targetId === currentUserId) {
				return res.status(403).json({ error: 'Нельзя удалить супер-админа или себя' })
			}
		}
		if (role === 'teacher') {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		const teacherName = targetTeacher.full_name
		const teacherEmail = targetTeacher.email
		const teacherSchool = targetTeacher.school

		await Teacher.findByIdAndDelete(targetId)

		await createNotification({
			type: 'teacher_delete',
			title: '🗑️ Удалён учитель',
			message: `Удалён учитель: ${teacherName} (${teacherEmail}) из школы "${teacherSchool}"`,
			details: { name: teacherName, email: teacherEmail, school: teacherSchool },
			targetRoles: ['super_admin', 'school_admin'],
			targetSchool: teacherSchool,
			createdBy: currentUserId,
		})

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
		const { role, school, id: currentUserId } = req.user

		const targetTeacher = await Teacher.findById(targetId)
		if (!targetTeacher) return res.status(404).json({ error: 'Учитель не найден' })

		if (role === 'teacher' && targetId !== currentUserId) {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}
		if (role === 'school_admin') {
			if (targetTeacher.school !== school) {
				return res.status(403).json({ error: 'Недостаточно прав' })
			}
			if (targetTeacher.role === 'super_admin' || targetTeacher.role === 'school_admin') {
				return res.status(403).json({ error: 'Нельзя менять статус администратора' })
			}
		}
		if (role === 'super_admin') {
			if (targetTeacher.role === 'super_admin' && targetId !== currentUserId) {
				return res.status(403).json({ error: 'Нельзя менять статус другого супер-админа' })
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
		const { role, school, id: currentUserId } = req.user

		const targetTeacher = await Teacher.findById(targetId)
		if (!targetTeacher) return res.status(404).json({ error: 'Учитель не найден' })

		if (role === 'teacher' && targetId !== currentUserId) {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}
		if (role === 'school_admin') {
			if (targetTeacher.school !== school) {
				return res.status(403).json({ error: 'Недостаточно прав' })
			}
			if (targetTeacher.role === 'super_admin') {
				return res.status(403).json({ error: 'Нельзя сбросить пароль супер-админа' })
			}
		}

		const newPassword = generateRandomPassword(12)
		targetTeacher.password = newPassword
		await targetTeacher.save()

		res.json({ newPassword })
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ GET /schools — Получить список школ ============
router.get('/schools', authenticateToken, async (req, res) => {
	try {
		const { role, school } = req.user
		let query = {}

		if (role === 'teacher') {
			query = { school: school }
		}

		const schools = await Teacher.distinct('school', query)
		const schoolsWithIds = schools.map(s => ({
			id: s.toLowerCase().replace(/[^a-z0-9]/g, '_'),
			name: s,
		}))

		res.json(schoolsWithIds)
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'Ошибка получения школ' })
	}
})

// ============ POST /switch-school — Переключить школу ============
router.post('/switch-school', authenticateToken, async (req, res) => {
	try {
		const { school } = req.body
		const { id: userId, role } = req.user

		if (role !== 'super_admin') {
			return res.status(403).json({ error: 'Только супер-администратор может переключать школы' })
		}

		const teachers = await Teacher.find({ school })
		if (teachers.length === 0) {
			return res.status(404).json({ error: 'Школа не найдена' })
		}

		const user = await Teacher.findById(userId)
		user.school = school
		await user.save()

		res.json({
			message: 'Школа переключена',
			school: school,
			user: {
				id: user._id,
				full_name: user.full_name,
				email: user.email,
				role: user.role,
				school: user.school,
			},
		})
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'Ошибка переключения школы' })
	}
})

// ============ POST /:id/change-password — Смена пароля ============
router.post('/:id/change-password', authenticateToken, async (req, res) => {
	try {
		const targetId = req.params.id
		const { id: currentUserId, role: currentUserRole } = req.user
		const { currentPassword, newPassword } = req.body

		if (targetId !== currentUserId) {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		const teacher = await Teacher.findById(targetId)
		if (!teacher) {
			return res.status(404).json({ error: 'Учитель не найден' })
		}

		const isValid = await teacher.comparePassword(currentPassword)
		if (!isValid) {
			return res.status(401).json({ error: 'Неверный текущий пароль' })
		}

		if (newPassword.length < 6) {
			return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' })
		}

		const salt = await bcrypt.genSalt(10)
		teacher.password = await bcrypt.hash(newPassword, salt)
		await teacher.save()

		await createNotification({
			type: 'password_change',
			title: '🔐 Смена пароля',
			message: `${teacher.full_name} (${teacher.email}) сменил пароль`,
			details: { userId: teacher._id, email: teacher.email, name: teacher.full_name },
			targetRoles: ['super_admin'],
			createdBy: currentUserId,
		})

		res.json({ message: 'Пароль успешно изменён' })
	} catch (err) {
		console.error('❌ Ошибка смены пароля:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ PATCH /:id/change-school — Сменить школу учителя ============
router.patch('/:id/change-school', authenticateToken, async (req, res) => {
	try {
		const targetId = req.params.id
		const { role, school: currentUserSchool, id: currentUserId } = req.user
		const { school: newSchool } = req.body

		const targetTeacher = await Teacher.findById(targetId)
		if (!targetTeacher) {
			return res.status(404).json({ error: 'Учитель не найден' })
		}

		if (role === 'teacher') {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		if (role === 'school_admin') {
			if (targetTeacher.school !== currentUserSchool) {
				return res.status(403).json({ error: 'Недостаточно прав' })
			}
			if (targetTeacher.role === 'super_admin' || targetTeacher.role === 'school_admin') {
				return res.status(403).json({ error: 'Нельзя менять школу администратора' })
			}
		}

		if (role === 'super_admin') {
			if (targetTeacher.role === 'super_admin' && targetId !== currentUserId) {
				return res.status(403).json({ error: 'Нельзя менять школу супер-админа' })
			}
		}

		const oldSchool = targetTeacher.school
		targetTeacher.school = newSchool
		await targetTeacher.save()

		await createNotification({
			type: 'teacher_edit',
			title: '🏫 Смена школы учителя',
			message: `Учитель ${targetTeacher.full_name} переведён из "${oldSchool}" в "${newSchool}"`,
			details: {
				userId: targetTeacher._id,
				name: targetTeacher.full_name,
				oldSchool,
				newSchool,
			},
			targetRoles: ['super_admin', 'school_admin'],
			targetSchool: newSchool,
			createdBy: currentUserId,
		})

		res.json({
			message: 'Школа учителя изменена',
			teacher: {
				id: targetTeacher._id,
				full_name: targetTeacher.full_name,
				school: targetTeacher.school,
			},
		})
	} catch (err) {
		console.error('❌ Ошибка смены школы:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ PATCH /:id/role — Обновить роль пользователя ============
router.patch('/:id/role', authenticateToken, async (req, res) => {
	try {
		const targetId = req.params.id
		const { role, id: currentUserId } = req.user
		const { role: newRole } = req.body

		if (role !== 'super_admin') {
			return res.status(403).json({ error: 'Только супер-администратор может менять роли' })
		}

		const targetUser = await Teacher.findById(targetId)
		if (!targetUser) {
			return res.status(404).json({ error: 'Пользователь не найден' })
		}

		if (targetUser.role === 'super_admin' && targetId !== currentUserId) {
			return res.status(403).json({ error: 'Нельзя менять роль другого супер-администратора' })
		}

		targetUser.role = newRole
		await targetUser.save()

		if (newRole === 'school_admin') {
			const Permission = require('../models/Permission.js')
			await Permission.findOneAndUpdate(
				{ user_id: targetId },
				{
					$set: {
						'permissions.is_school_admin': true,
						'permissions.manage_bitcraft': true,
						'permissions.view_test_results': true,
						'permissions.view_teachers': true,
						'permissions.manage_teachers': true,
						'permissions.edit_teachers': true,
						updated_at: new Date(),
					},
				},
				{ upsert: true },
			)
		}

		res.json({
			message: 'Роль обновлена',
			user: {
				id: targetUser._id,
				full_name: targetUser.full_name,
				email: targetUser.email,
				role: targetUser.role,
			},
		})
	} catch (err) {
		console.error('❌ Ошибка изменения роли:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ GET /public — Публичный список учителей для регистрации ============
router.get('/public', async (req, res) => {
	try {
		const { school, search } = req.query

		// Базовый запрос — только активные учителя
		let query = { is_active: true }

		// Если указана школа — фильтруем по ней
		if (school) {
			query.school = school
		}

		// Получаем всех учителей
		let teachers = await Teacher.find(query)
			.select('full_name email subject school role')
			.sort('full_name')

		// ❌ Супер-администраторов НЕ показываем
		teachers = teachers.filter(t => t.role !== 'super_admin')

		// ✅ Фильтруем по правам show_in_test_registration
		const Permission = require('../models/Permission.js')
		const permissions = await Permission.find({
			user_id: { $in: teachers.map(t => t._id) },
		})

		teachers = teachers.filter(teacher => {
			const perm = permissions.find(p => p.user_id.toString() === teacher._id.toString())
			// Если прав нет — показываем (по умолчанию true)
			if (!perm) return true
			// Если есть права — проверяем флаг
			return perm.permissions?.show_in_test_registration !== false
		})

		// Если есть поиск по имени
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

module.exports = router
