// server/src/routes/notifications.js
const express = require('express')
const router = express.Router()
const { authenticateToken } = require('../middleware/auth.js')
const { getNotifications, markAsRead, markAllAsRead } = require('../utils/notifications.js')

// ============ GET / — Получить уведомления ============
router.get('/', authenticateToken, async (req, res) => {
	try {
		const { id: userId, role, school } = req.user
		const notifications = await getNotifications(userId, role, school)
		res.json(notifications)
	} catch (error) {
		console.error('❌ Ошибка получения уведомлений:', error)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ PATCH /:id/read — Отметить как прочитано ============
router.patch('/:id/read', authenticateToken, async (req, res) => {
	try {
		const { id: userId } = req.user
		const notificationId = req.params.id
		const result = await markAsRead(notificationId, userId)
		res.json({ success: result })
	} catch (error) {
		console.error('❌ Ошибка:', error)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ PATCH /read-all — Отметить все как прочитано ============
router.patch('/read-all', authenticateToken, async (req, res) => {
	try {
		const { id: userId } = req.user
		const result = await markAllAsRead(null, userId)
		res.json({ success: result })
	} catch (error) {
		console.error('❌ Ошибка:', error)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

module.exports = router
