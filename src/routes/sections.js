// server/src/routes/sections.js
const express = require('express')
const router = express.Router()
const Section = require('../models/Section.js')
const Test = require('../models/Test.js')
const { authenticateToken } = require('../middleware/auth.js')

// ============ GET / — Получить все разделы ============
router.get('/', async (req, res) => {
	try {
		const { type, active } = req.query
		let query = {}

		if (type) query.type = type
		if (active === 'true') query.isActive = true
		if (active === 'false') query.isActive = false

		const sections = await Section.find(query)
			.sort({ type: -1, order: 1 })
			.populate('createdBy', 'full_name email')

		res.json(sections)
	} catch (err) {
		console.error('❌ Ошибка получения разделов:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ GET /:id — Получить раздел по ID ============
router.get('/:id', async (req, res) => {
	try {
		const section = await Section.findOne({ id: req.params.id }).populate(
			'createdBy',
			'full_name email',
		)

		if (!section) {
			return res.status(404).json({ error: 'Раздел не найден' })
		}

		res.json(section)
	} catch (err) {
		console.error('❌ Ошибка получения раздела:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ POST / — Создать раздел ============
router.post('/', authenticateToken, async (req, res) => {
	try {
		const { role, id: userId } = req.user

		if (role !== 'super_admin' && role !== 'school_admin') {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		const { id, title, icon, color, description, type, order, parentId } = req.body

		if (!id || !title) {
			return res.status(400).json({ error: 'ID и название обязательны' })
		}

		if (!/^[a-zA-Z0-9-_]+$/.test(id)) {
			return res.status(400).json({
				error: 'ID может содержать только латиницу, цифры, дефис и подчёркивание',
			})
		}

		const existing = await Section.findOne({ id })
		if (existing) {
			return res.status(400).json({ error: 'Раздел с таким ID уже существует' })
		}

		const section = new Section({
			id,
			title,
			icon: icon || '📚',
			color: color || '#4facfe',
			description: description || '',
			type: type || 'custom',
			order: order || 0,
			parentId: parentId || null,
			createdBy: userId,
		})

		await section.save()

		const { createNotification } = require('../utils/notifications.js')
		await createNotification({
			type: 'section_add',
			title: '📁 Создан новый раздел',
			message: `Создан раздел: "${title}" (${id})`,
			details: { sectionId: section.id, title },
			targetRoles: ['all', 'super_admin', 'school_admin', 'teacher'],
			createdBy: userId,
		})

		res.status(201).json(section)
	} catch (err) {
		console.error('❌ Ошибка создания раздела:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ PUT /:id — Обновить раздел ============
router.put('/:id', authenticateToken, async (req, res) => {
	try {
		const { role } = req.user

		if (role !== 'super_admin' && role !== 'school_admin') {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		const section = await Section.findOne({ id: req.params.id })
		if (!section) {
			return res.status(404).json({ error: 'Раздел не найден' })
		}

		const { title, icon, color, description, order, isActive, parentId } = req.body

		if (title !== undefined) section.title = title
		if (icon !== undefined) section.icon = icon
		if (color !== undefined) section.color = color
		if (description !== undefined) section.description = description
		if (order !== undefined) section.order = order
		if (isActive !== undefined) section.isActive = isActive
		if (parentId !== undefined) section.parentId = parentId
		section.updatedAt = new Date()

		await section.save()
		res.json(section)
	} catch (err) {
		console.error('❌ Ошибка обновления раздела:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ DELETE /:id — Удалить раздел ============
router.delete('/:id', authenticateToken, async (req, res) => {
	try {
		const { role } = req.user

		if (role !== 'super_admin' && role !== 'school_admin') {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		const section = await Section.findOne({ id: req.params.id })
		if (!section) {
			return res.status(404).json({ error: 'Раздел не найден' })
		}

		const testCount = await Test.countDocuments({ sectionId: section.id })
		if (testCount > 0) {
			return res.status(400).json({
				error: `Нельзя удалить раздел, в котором есть ${testCount} тестов. Сначала переместите или удалите тесты.`,
			})
		}

		await Section.findOneAndDelete({ id: req.params.id })
		res.json({ message: 'Раздел удалён' })
	} catch (err) {
		console.error('❌ Ошибка удаления раздела:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ POST /init — Инициализация классов ============
router.post('/init', authenticateToken, async (req, res) => {
	try {
		const defaultSections = [
			{
				id: '6',
				title: '6 класс - Основы информатики',
				description:
					'Погружение в мир информации и компьютерных технологий. Идеальный старт для начинающих.',
				icon: '🧠',
				color: '#4facfe',
				type: 'class',
				order: 6,
				isActive: true,
			},
			{
				id: '7',
				title: '7 класс - Алгоритмы и логика',
				description:
					'Изучаем логику, алгоритмы и устройство компьютера. Развиваем алгоритмическое мышление.',
				icon: '💻',
				color: '#667eea',
				type: 'class',
				order: 7,
				isActive: true,
			},
			{
				id: '8',
				title: '8 класс - Технологии и программирование',
				description:
					'Осваиваем анимацию, программирование и современные технологии обработки информации.',
				icon: '🚀',
				color: '#ffd700',
				type: 'class',
				order: 8,
				isActive: true,
			},
			{
				id: '9',
				title: '9 класс - Профессиональные инструменты',
				description: 'Работаем с базами данных, таблицами и информационными моделями.',
				icon: '🌐',
				color: '#ff6b6b',
				type: 'class',
				order: 9,
				isActive: false,
			},
			{
				id: '10',
				title: '10 класс - Углублённое программирование',
				description:
					'Изучаем углублённые алгоритмы, объектно-ориентированное программирование и компьютерные сети.',
				icon: '🔬',
				color: '#9d50bb',
				type: 'class',
				order: 10,
				isActive: false,
			},
			{
				id: '11',
				title: '11 класс - Подготовка к IT-профессии',
				description: 'Изучение современных IT технологий.',
				icon: '🎯',
				color: '#ff416c',
				type: 'class',
				order: 11,
				isActive: false,
			},
		]

		let created = 0
		for (const section of defaultSections) {
			const existing = await Section.findOne({ id: section.id })
			if (!existing) {
				await Section.create(section)
				created++
			}
		}

		res.json({ message: `Инициализировано ${created} разделов` })
	} catch (err) {
		console.error('❌ Ошибка инициализации разделов:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

module.exports = router
