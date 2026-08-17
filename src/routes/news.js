// server/src/routes/news.js
const express = require('express')
const router = express.Router()
const News = require('../models/News.js')
const { authenticateToken } = require('../middleware/auth.js')

// ============ GET / — Получить все новости ============
router.get('/', async (req, res) => {
	try {
		const { type, search, limit = 20, page = 1 } = req.query
		let query = {}

		if (type && type !== 'all') {
			query.type = type
		}

		if (search) {
			query.$text = { $search: search }
		}

		const skip = (parseInt(page) - 1) * parseInt(limit)

		const news = await News.find(query)
			.sort({ isPinned: -1, createdAt: -1 })
			.skip(skip)
			.limit(parseInt(limit))

		const total = await News.countDocuments(query)

		res.json({
			news,
			pagination: {
				total,
				page: parseInt(page),
				limit: parseInt(limit),
				pages: Math.ceil(total / parseInt(limit)),
			},
		})
	} catch (err) {
		console.error('❌ Ошибка получения новостей:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ GET /:id — Получить новость по ID ============
router.get('/:id', async (req, res) => {
	try {
		const news = await News.findById(req.params.id)
		if (!news) {
			return res.status(404).json({ error: 'Новость не найдена' })
		}
		res.json(news)
	} catch (err) {
		console.error('❌ Ошибка получения новости:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ POST / — Создать новость ============
router.post('/', authenticateToken, async (req, res) => {
	try {
		const { role, id: userId } = req.user

		if (role !== 'super_admin' && role !== 'school_admin') {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		const { title, preview, content, type, category, tags, author, isPinned } = req.body

		if (!title || !preview) {
			return res.status(400).json({ error: 'Название и превью обязательны' })
		}

		const news = new News({
			title,
			preview,
			content: content || { text: '', images: [], video: null },
			type: type || 'all',
			category: category || 'Новости',
			tags: tags || [],
			author: author || 'Администрация',
			isPinned: isPinned || false,
			createdBy: userId,
		})

		await news.save()

		// Уведомление
		const { createNotification } = require('../utils/notifications.js')
		await createNotification({
			type: 'news_add',
			title: '📰 Новая новость',
			message: `Опубликована новость: "${title}"`,
			details: { newsId: news._id, title },
			targetRoles: ['all', 'super_admin', 'school_admin', 'teacher'],
			createdBy: userId,
		})

		res.status(201).json(news)
	} catch (err) {
		console.error('❌ Ошибка создания новости:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ PUT /:id — Обновить новость ============
router.put('/:id', authenticateToken, async (req, res) => {
	try {
		const { role, id: userId } = req.user

		if (role !== 'super_admin' && role !== 'school_admin') {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		const news = await News.findById(req.params.id)
		if (!news) {
			return res.status(404).json({ error: 'Новость не найдена' })
		}

		const { title, preview, content, type, category, tags, author, isPinned } = req.body

		if (title) news.title = title
		if (preview) news.preview = preview
		if (content) news.content = content
		if (type) news.type = type
		if (category) news.category = category
		if (tags) news.tags = tags
		if (author) news.author = author
		if (isPinned !== undefined) news.isPinned = isPinned
		news.updatedAt = new Date()

		await news.save()

		res.json(news)
	} catch (err) {
		console.error('❌ Ошибка обновления новости:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ DELETE /:id — Удалить новость ============
router.delete('/:id', authenticateToken, async (req, res) => {
	try {
		const { role } = req.user

		if (role !== 'super_admin' && role !== 'school_admin') {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		const news = await News.findById(req.params.id)
		if (!news) {
			return res.status(404).json({ error: 'Новость не найдена' })
		}

		await News.findByIdAndDelete(req.params.id)

		res.json({ message: 'Новость удалена' })
	} catch (err) {
		console.error('❌ Ошибка удаления новости:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

module.exports = router
