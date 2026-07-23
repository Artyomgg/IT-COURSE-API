const express = require('express')
const router = express.Router()
const TeacherSchedule = require('../models/TeacherSchedule.js')
const Teacher = require('../models/Teacher.js')
const { authenticateToken } = require('../middleware/auth.js')

// ============ GET / — Получить все расписания ============
router.get('/', authenticateToken, async (req, res) => {
	try {
		const { role, id } = req.user
		let query = {}

		if (role === 'teacher') {
			query = { teacher_id: id }
		} else if (role === 'super_admin') {
			query = {} // ✅ Всё расписание всех учителей из всех школ
		}

		const schedules = await TeacherSchedule.find(query)
			.populate('teacher_id', 'full_name subject school')
			.sort('day_of_week lesson_number')
		res.json(schedules)
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ POST / — Создать урок ============
router.post('/', authenticateToken, async (req, res) => {
	try {
		const {
			teacher_id,
			day_of_week,
			lesson_number,
			start_time,
			end_time,
			subject,
			class_name,
			group_name,
			classroom,
		} = req.body
		const { role, id: currentUserId } = req.user

		const targetTeacher = await Teacher.findById(teacher_id)
		if (!targetTeacher) return res.status(404).json({ error: 'Учитель не найден' })

		if (role === 'teacher' && teacher_id !== currentUserId) {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}
		// ✅ Супер-админ может создавать уроки для любого учителя

		const schedule = new TeacherSchedule({
			teacher_id,
			day_of_week,
			lesson_number,
			start_time,
			end_time,
			subject: subject || targetTeacher.subject,
			class_name,
			group_name,
			classroom,
		})
		await schedule.save()

		const populated = await TeacherSchedule.findById(schedule._id).populate(
			'teacher_id',
			'full_name subject',
		)
		res.status(201).json(populated)
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ PUT /:id — Обновить урок ============
router.put('/:id', authenticateToken, async (req, res) => {
	try {
		const scheduleId = req.params.id
		const { role, id: currentUserId } = req.user

		const schedule = await TeacherSchedule.findById(scheduleId).populate('teacher_id')
		if (!schedule) return res.status(404).json({ error: 'Расписание не найдено' })

		if (role === 'teacher' && schedule.teacher_id._id.toString() !== currentUserId) {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}
		// ✅ Супер-админ может редактировать любое расписание

		const update = req.body
		const updated = await TeacherSchedule.findByIdAndUpdate(scheduleId, update, {
			new: true,
		}).populate('teacher_id', 'full_name subject')
		res.json(updated)
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ DELETE /:id — Удалить урок ============
router.delete('/:id', authenticateToken, async (req, res) => {
	try {
		const scheduleId = req.params.id
		const { role, id: currentUserId } = req.user

		const schedule = await TeacherSchedule.findById(scheduleId).populate('teacher_id')
		if (!schedule) return res.status(404).json({ error: 'Расписание не найдено' })

		if (role === 'teacher' && schedule.teacher_id._id.toString() !== currentUserId) {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}
		// ✅ Супер-админ может удалить любое расписание

		await TeacherSchedule.findByIdAndDelete(scheduleId)
		res.json({ message: 'Урок удален' })
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

module.exports = router
