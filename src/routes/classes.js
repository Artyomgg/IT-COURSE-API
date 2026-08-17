// server/src/routes/classes.js
const express = require('express')
const router = express.Router()
const Class = require('../models/Class.js')
const { authenticateToken } = require('../middleware/auth.js')

// ============ GET / — Получить все классы ============
router.get('/', async (req, res) => {
	try {
		const classes = await Class.find({}).sort({ order: 1 })
		res.json(classes)
	} catch (err) {
		console.error('❌ Ошибка получения классов:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ GET /:id — Получить класс по ID ============
router.get('/:id', async (req, res) => {
	try {
		const classData = await Class.findOne({ id: req.params.id })
		if (!classData) {
			return res.status(404).json({ error: 'Класс не найден' })
		}
		res.json(classData)
	} catch (err) {
		console.error('❌ Ошибка получения класса:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ PUT /:id — Обновить класс ============
router.put('/:id', authenticateToken, async (req, res) => {
	try {
		const { id } = req.params
		const { title, description, icon, color, testsAvailable, order, isActive } = req.body

		let classData = await Class.findOne({ id })

		if (!classData) {
			classData = new Class({
				id,
				title: title || `${id} класс`,
				description: description || '',
				icon: icon || '📚',
				color: color || '#4facfe',
				testsAvailable: testsAvailable !== undefined ? testsAvailable : true,
				isActive: isActive !== undefined ? isActive : true,
				order: order || parseInt(id),
			})
			await classData.save()
			return res.json(classData)
		}

		if (title !== undefined) classData.title = title
		if (description !== undefined) classData.description = description
		if (icon !== undefined) classData.icon = icon
		if (color !== undefined) classData.color = color
		if (testsAvailable !== undefined) classData.testsAvailable = testsAvailable
		if (isActive !== undefined) classData.isActive = isActive // ✅ ОБРАБОТКА isActive
		if (order !== undefined) classData.order = order
		classData.updatedAt = new Date()

		await classData.save()
		res.json(classData)
	} catch (err) {
		console.error('❌ Ошибка обновления класса:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ POST /init — Инициализация классов ============
router.post('/init', authenticateToken, async (req, res) => {
	try {
		const defaultClasses = [
			{
				id: '6',
				title: '6 класс - Основы информатики',
				description:
					'Погружение в мир информации и компьютерных технологий. Идеальный старт для начинающих.',
				icon: '🧠',
				color: '#4facfe',
				order: 6,
				testsAvailable: true,
			},
			{
				id: '7',
				title: '7 класс - Алгоритмы и логика',
				description:
					'Изучаем логику, алгоритмы и устройство компьютера. Развиваем алгоритмическое мышление.',
				icon: '💻',
				color: '#667eea',
				order: 7,
				testsAvailable: true,
			},
			{
				id: '8',
				title: '8 класс - Технологии и программирование',
				description:
					'Осваиваем анимацию, программирование и современные технологии обработки информации.',
				icon: '🚀',
				color: '#ffd700',
				order: 8,
				testsAvailable: true,
			},
			{
				id: '9',
				title: '9 класс - Профессиональные инструменты',
				description: 'Работаем с базами данных, таблицами и информационными моделями.',
				icon: '🌐',
				color: '#ff6b6b',
				order: 9,
				testsAvailable: false,
			},
			{
				id: '10',
				title: '10 класс - Углублённое программирование',
				description:
					'Изучаем углублённые алгоритмы, объектно-ориентированное программирование и компьютерные сети.',
				icon: '🔬',
				color: '#9d50bb',
				order: 10,
				testsAvailable: false,
			},
			{
				id: '11',
				title: '11 класс - Подготовка к IT-профессии',
				description: 'Изучение современных IT технологий.',
				icon: '🎯',
				color: '#ff416c',
				order: 11,
				testsAvailable: false,
			},
		]

		let created = 0
		for (const cls of defaultClasses) {
			const existing = await Class.findOne({ id: cls.id })
			if (!existing) {
				await Class.create(cls)
				created++
			}
		}

		res.json({ message: `Инициализировано ${created} классов` })
	} catch (err) {
		console.error('❌ Ошибка инициализации классов:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

module.exports = router
