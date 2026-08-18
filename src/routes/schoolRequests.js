// server/src/routes/schoolRequests.js
const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const SchoolRequest = require('../models/SchoolRequest.js')
const Teacher = require('../models/Teacher.js')
const Permission = require('../models/Permission.js')
const { authenticateToken } = require('../middleware/auth.js')
const { createNotification } = require('../utils/notifications.js')
const { sendSchoolApprovalEmail, sendSchoolRejectionEmail } = require('../utils/email.js')

const generateRandomPassword = (length = 12) => {
	const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
	return Array.from({ length }, () =>
		charset.charAt(Math.floor(Math.random() * charset.length)),
	).join('')
}

// ============================================
// ✅ ПУБЛИЧНЫЙ — подача заявки (без авторизации)
// ============================================
router.post('/', async (req, res) => {
	try {
		const {
			schoolName,
			schoolAddress,
			schoolPhone,
			schoolEmail,
			directorName,
			teacherName,
			teacherEmail,
			teacherPhone,
			message,
		} = req.body

		if (!schoolName || !schoolEmail || !directorName || !teacherName || !teacherEmail) {
			return res.status(400).json({ error: 'Заполните все обязательные поля' })
		}

		// Проверка на дубликат
		const existing = await SchoolRequest.findOne({
			$or: [{ schoolEmail }, { teacherEmail }, { schoolName }],
			status: { $ne: 'rejected' },
		})

		if (existing) {
			return res.status(400).json({
				error: 'Заявка от этой школы или учителя уже существует',
			})
		}

		const request = new SchoolRequest({
			schoolName,
			schoolAddress: schoolAddress || '',
			schoolPhone: schoolPhone || '',
			schoolEmail,
			directorName,
			teacherName,
			teacherEmail,
			teacherPhone: teacherPhone || '',
			message: message || '',
			status: 'pending',
		})

		await request.save()

		// Уведомление для супер-админа
		await createNotification({
			type: 'school_request',
			title: '🏫 Новая заявка на регистрацию школы',
			message: `${schoolName} подала заявку на регистрацию. Контакт: ${teacherName} (${teacherEmail})`,
			details: { requestId: request._id, schoolName },
			targetRoles: ['super_admin'],
			createdBy: 'system',
		})

		res.status(201).json({
			message: 'Заявка отправлена! Ожидайте подтверждения.',
			requestId: request._id,
		})
	} catch (err) {
		console.error('❌ Ошибка создания заявки:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============================================
// 🔒 АДМИНСКИЕ — управление заявками
// ============================================

// ============ GET / — Получить все заявки ============
router.get('/', authenticateToken, async (req, res) => {
	try {
		const { role } = req.user
		if (role !== 'super_admin') {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		const requests = await SchoolRequest.find({})
			.sort({ createdAt: -1 })
			.populate('processedBy', 'full_name email')

		res.json(requests)
	} catch (err) {
		console.error('❌ Ошибка получения заявок:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ PUT /:id/approve — Одобрить заявку ============
router.put('/:id/approve', authenticateToken, async (req, res) => {
	try {
		const { role, id: currentUserId } = req.user
		if (role !== 'super_admin') {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		const request = await SchoolRequest.findById(req.params.id)
		if (!request) {
			return res.status(404).json({ error: 'Заявка не найдена' })
		}

		if (request.status === 'approved') {
			return res.status(400).json({ error: 'Заявка уже одобрена' })
		}

		// ============ 1. СОЗДАЁМ АДМИНИСТРАТОРА ШКОЛЫ ============
		const salt = await bcrypt.genSalt(10)
		const tempPassword = generateRandomPassword(12)

		let username = request.teacherEmail
			.split('@')[0]
			.toLowerCase()
			.replace(/[^a-z0-9]/g, '_')

		// Проверяем, не занят ли username
		const existingUser = await Teacher.findOne({ username })
		if (existingUser) {
			username = username + '_' + Math.floor(Math.random() * 1000)
		}

		// Проверяем, не занят ли email
		const existingEmail = await Teacher.findOne({ email: request.teacherEmail })
		if (existingEmail) {
			return res.status(400).json({
				error: `Пользователь с email ${request.teacherEmail} уже существует`,
			})
		}

		const admin = new Teacher({
			full_name: request.teacherName,
			username: username,
			email: request.teacherEmail,
			phone: request.teacherPhone || '',
			password: await bcrypt.hash(tempPassword, salt),
			school: request.schoolName,
			school_id: request.schoolName
				.toLowerCase()
				.replace(/[^a-z0-9]/g, '_')
				.replace(/_+/g, '_'),
			subject: 'Информатика',
			role: 'school_admin',
			is_active: true,
		})

		await admin.save()

		// ============ 2. СОЗДАЁМ ПРАВА ============
		const defaultPermissions = {
			manage_bitcraft: false,
			view_bitcraft: true,
			manage_tests: false,
			view_tests: true,
			view_test_results: true,
			export_test_results: true,
			view_teachers: true,
			manage_teachers: false,
			edit_teachers: false,
			delete_teachers: false,
			reset_teacher_password: false,
			view_profile: true,
			edit_profile: true,
			change_password: true,
			view_notifications: true,
			is_school_admin: true,
			show_in_test_registration: true,
		}

		const permission = new Permission({
			user_id: admin._id,
			permissions: defaultPermissions,
		})
		await permission.save()

		// ============ 3. ОБНОВЛЯЕМ ЗАЯВКУ ============
		request.status = 'approved'
		request.processedBy = currentUserId
		request.processedAt = new Date()
		request.createdAdminId = admin._id
		await request.save()

		// ============ 4. ОТПРАВКА EMAIL ============
		try {
			await sendSchoolApprovalEmail({
				to: request.teacherEmail,
				schoolName: request.schoolName,
				adminName: request.teacherName,
				adminEmail: request.teacherEmail,
				adminPassword: tempPassword,
				loginLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/login`,
			})
			console.log(`📧 Email отправлен на ${request.teacherEmail}`)
		} catch (emailError) {
			console.error('❌ Ошибка отправки email:', emailError)
		}

		// ============ 5. УВЕДОМЛЕНИЯ ============
		await createNotification({
			type: 'school_approved',
			title: '✅ Школа зарегистрирована',
			message: `Школа "${request.schoolName}" успешно зарегистрирована. Администратор: ${admin.full_name}`,
			details: { adminId: admin._id },
			targetRoles: ['super_admin'],
			createdBy: currentUserId,
		})

		await createNotification({
			type: 'school_approved',
			title: '✅ Ваша заявка одобрена!',
			message: `Школа "${request.schoolName}" успешно зарегистрирована на платформе IT-COURSE.`,
			details: { adminId: admin._id },
			targetRoles: ['school_admin'],
			targetSchool: request.schoolName,
			createdBy: currentUserId,
		})

		res.json({
			message: 'Школа успешно зарегистрирована! Email отправлен!',
			school: { name: request.schoolName },
			admin: {
				id: admin._id,
				full_name: admin.full_name,
				email: admin.email,
				username: admin.username,
				password: tempPassword,
			},
			permissions: defaultPermissions,
		})
	} catch (err) {
		console.error('❌ Ошибка одобрения заявки:', err)

		if (err.code === 11000) {
			return res.status(400).json({
				error: 'Пользователь с таким email уже существует в системе',
			})
		}

		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ PUT /:id/reject — Отклонить заявку ============
router.put('/:id/reject', authenticateToken, async (req, res) => {
	try {
		const { role, id: currentUserId } = req.user
		if (role !== 'super_admin') {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		const { reason } = req.body
		const request = await SchoolRequest.findById(req.params.id)
		if (!request) {
			return res.status(404).json({ error: 'Заявка не найдена' })
		}

		if (request.status === 'approved') {
			return res.status(400).json({ error: 'Нельзя отклонить уже одобренную заявку' })
		}

		request.status = 'rejected'
		request.processedBy = currentUserId
		request.processedAt = new Date()
		request.rejectionReason = reason || 'Заявка отклонена'
		await request.save()

		// ============ ✅ ОТПРАВКА EMAIL ОБ ОТКАЗЕ ============
		try {
			await sendSchoolRejectionEmail({
				to: request.teacherEmail,
				schoolName: request.schoolName,
				reason: request.rejectionReason,
			})
			console.log(`📧 Email об отказе отправлен на ${request.teacherEmail}`)
		} catch (emailError) {
			console.error('❌ Ошибка отправки email об отказе:', emailError)
		}

		// ============ УВЕДОМЛЕНИЕ В СИСТЕМЕ ============
		await createNotification({
			type: 'school_rejected',
			title: '❌ Заявка отклонена',
			message: `Заявка от школы "${request.schoolName}" отклонена. Причина: ${request.rejectionReason}`,
			details: { requestId: request._id },
			targetRoles: ['super_admin'],
			createdBy: currentUserId,
		})

		res.json({
			message: 'Заявка отклонена. Письмо отправлено на почту заявителя.',
		})
	} catch (err) {
		console.error('❌ Ошибка отклонения заявки:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

module.exports = router
