// server/src/routes/interactives.js
const express = require('express')
const router = express.Router()
const Interactive = require('../models/Interactive.js')
const { authenticateToken } = require('../middleware/auth.js')
const { createNotification } = require('../utils/notifications.js')

// ============ GET / — Получить все интерактивы ============
router.get('/', async (req, res) => {
	try {
		const { search, class: classFilter } = req.query
		let query = {}

		if (search) {
			query.$or = [
				{ title: { $regex: search, $options: 'i' } },
				{ description: { $regex: search, $options: 'i' } },
			]
		}
		if (classFilter && classFilter !== 'all') {
			query.class = classFilter
		}

		const interactives = await Interactive.find(query).sort({ class: 1, title: 1 })
		res.json(interactives)
	} catch (err) {
		console.error('❌ Ошибка получения интерактивов:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ POST / — Добавить интерактив ============
router.post('/', authenticateToken, async (req, res) => {
	try {
		const { role, id: userId } = req.user

		if (role !== 'super_admin' && role !== 'school_admin') {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		const { title, description, class: className, embedUrl, thumbnail } = req.body

		if (!title || !embedUrl) {
			return res.status(400).json({ error: 'Название и ссылка обязательны' })
		}

		const interactive = new Interactive({
			title,
			description: description || '',
			class: className || 'любой',
			embedUrl,
			thumbnail: thumbnail || '',
		})

		await interactive.save()

		// ✅ Уведомление для всех
		await createNotification({
			type: 'bitcraft_add',
			title: '🎮 Новый интерактив в BitCraft',
			message: `Добавлен новый интерактив: "${interactive.title}" (${interactive.class} класс)`,
			details: {
				interactiveId: interactive._id,
				title: interactive.title,
				class: interactive.class,
			},
			targetRoles: ['all', 'super_admin', 'school_admin', 'teacher'],
			createdBy: userId,
		})

		res.status(201).json(interactive)
	} catch (err) {
		console.error('❌ Ошибка создания интерактива:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ PUT /:id — Обновить интерактив ============
router.put('/:id', authenticateToken, async (req, res) => {
	try {
		const { role, id: userId } = req.user

		if (role !== 'super_admin' && role !== 'school_admin') {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		const { id } = req.params
		const { title, description, class: className, embedUrl, thumbnail } = req.body

		const interactive = await Interactive.findById(id)
		if (!interactive) {
			return res.status(404).json({ error: 'Интерактив не найден' })
		}

		const oldTitle = interactive.title

		interactive.title = title || interactive.title
		interactive.description = description || interactive.description
		interactive.class = className || interactive.class
		interactive.embedUrl = embedUrl || interactive.embedUrl
		interactive.thumbnail = thumbnail || interactive.thumbnail
		interactive.updated_at = new Date()

		await interactive.save()

		// ✅ Уведомление для всех
		await createNotification({
			type: 'bitcraft_update',
			title: '✏️ Обновлён интерактив в BitCraft',
			message: `Обновлён интерактив: "${oldTitle}" → "${interactive.title}"`,
			details: { interactiveId: interactive._id, title: interactive.title, oldTitle },
			targetRoles: ['all', 'super_admin', 'school_admin', 'teacher'],
			createdBy: userId,
		})

		res.json(interactive)
	} catch (err) {
		console.error('❌ Ошибка обновления интерактива:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ DELETE /:id — Удалить интерактив ============
router.delete('/:id', authenticateToken, async (req, res) => {
	try {
		const { role, id: userId } = req.user

		if (role !== 'super_admin' && role !== 'school_admin') {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		const { id } = req.params
		const interactive = await Interactive.findById(id)
		if (!interactive) {
			return res.status(404).json({ error: 'Интерактив не найден' })
		}

		const title = interactive.title

		await Interactive.findByIdAndDelete(id)

		// ✅ Уведомление для всех
		await createNotification({
			type: 'bitcraft_delete',
			title: '🗑️ Удалён интерактив из BitCraft',
			message: `Удалён интерактив: "${title}"`,
			details: { title },
			targetRoles: ['all', 'super_admin', 'school_admin', 'teacher'],
			createdBy: userId,
		})

		res.json({ message: 'Интерактив удалён' })
	} catch (err) {
		console.error('❌ Ошибка удаления интерактива:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

module.exports = router
