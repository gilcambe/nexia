'use strict';

const express = require('express');
const { scheduleProblem } = require('../../robots/schedule.js');
const { TEMPLATES } = require('../../robots/templates.js');

const router = express.Router();

// Middleware para validar tenant ID
const validateTenant = (req, res, next) => {
  const tenantId = req.get('X-Tenant-Id') || req.body.tenant_id || req.query.tenant_id;
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID é obrigatório' });
  }
  req.tenantId = tenantId;
  next();
};

// Lista automações ativas do tenant
router.get('/', validateTenant, async (req, res) => {
  try {
    // Aqui seria a lógica para buscar automações do tenant do banco de dados
    // Por enquanto retornando uma lista vazia como exemplo
    const automations = [];
    res.json({
      success: true,
      data: automations,
      message: 'Lista de automações retornada com sucesso'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao buscar automações', 
      details: error.message 
    });
  }
});

// Lista templates disponíveis
router.get('/templates', validateTenant, (req, res) => {
  try {
    res.json({
      success: true,
      data: TEMPLATES,
      message: 'Templates retornados com sucesso'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao buscar templates', 
      details: error.message 
    });
  }
});

// Cria nova automação a partir de template
router.post('/', validateTenant, async (req, res) => {
  try {
    const { template_id, name, schedule, custom_task } = req.body;
    
    // Validações básicas
    if (!template_id && !custom_task) {
      return res.status(400).json({ 
        success: false, 
        error: 'É necessário informar um template_id ou custom_task' 
      });
    }
    
    if (!name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nome da automação é obrigatório' 
      });
    }
    
    if (!schedule) {
      return res.status(400).json({ 
        success: false, 
        error: 'Agendamento é obrigatório' 
      });
    }
    
    // Validação do agendamento usando o motor existente
    const scheduleError = scheduleProblem(schedule);
    if (scheduleError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Agendamento inválido', 
        details: `Erro no campo: ${scheduleError}` 
      });
    }
    
    // Se for template, busca as informações
    let task;
    if (template_id) {
      const template = TEMPLATES.find(t => t.id === template_id);
      if (!template) {
        return res.status(404).json({ 
          success: false, 
          error: 'Template não encontrado' 
        });
      }
      task = template.task;
    } else {
      task = custom_task;
    }
    
    // Aqui seria a lógica para salvar no banco de dados
    const newAutomation = {
      id: `auto_${Date.now()}`,
      tenant_id: req.tenantId,
      name,
      task,
      schedule,
      status: 'active',
      created_at: new Date().toISOString(),
      template_id: template_id || null
    };
    
    // Simulação de salvamento no banco
    // await db.collection('automations').insert(newAutomation);
    
    res.status(201).json({
      success: true,
      data: newAutomation,
      message: 'Automação criada com sucesso'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao criar automação', 
      details: error.message 
    });
  }
});

// Pausa uma automação
router.put('/:id/pause', validateTenant, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Valida se o ID foi informado
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID da automação é obrigatório' 
      });
    }
    
    // Aqui seria a lógica para buscar e atualizar no banco
    // const automation = await db.collection('automations').findOne({ id, tenant_id: req.tenantId });
    // if (!automation) {
    //   return res.status(404).json({ 
    //     success: false, 
    //     error: 'Automação não encontrada' 
    //   });
    // }
    
    // const updatedAutomation = await db.collection('automations').updateOne(
    //   { id, tenant_id: req.tenantId },
    //   { $set: { status: 'paused' } }
    // );
    
    // Simulação de atualização
    const updatedAutomation = {
      id,
      tenant_id: req.tenantId,
      status: 'paused',
      paused_at: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: updatedAutomation,
      message: 'Automação pausada com sucesso'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao pausar automação', 
      details: error.message 
    });
  }
});

// Apaga uma automação
router.delete('/:id', validateTenant, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Valida se o ID foi informado
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID da automação é obrigatório' 
      });
    }
    
    // Aqui seria a lógica para deletar no banco
    // const result = await db.collection('automations').deleteOne({ id, tenant_id: req.tenantId });
    // if (result.deletedCount === 0) {
    //   return res.status(404).json({ 
    //     success: false, 
    //     error: 'Automação não encontrada' 
    //   });
    // }
    
    res.json({
      success: true,
      message: 'Automação deletada com sucesso'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao deletar automação', 
      details: error.message 
    });
  }
});

module.exports = router;