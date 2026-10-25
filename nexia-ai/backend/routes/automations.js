'use strict';

const express = require('express');
const { scheduleProblem } = require('../../robots/schedule.js');
const { TEMPLATES } = require('../../robots/templates.js');

const router = express.Router();

// Armazenamento em memória para simular banco de dados
// Em um ambiente real, isso seria substituído por um banco de dados real
let automationsStorage = [];

// Gerador de ID simples
function generateId() {
  return `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Busca automações por tenant
function getAutomationsByTenant(tenantId) {
  return automationsStorage.filter(auto => auto.tenant_id === tenantId);
}

// Busca automação por ID e tenant
function getAutomationById(id, tenantId) {
  return automationsStorage.find(auto => auto.id === id && auto.tenant_id === tenantId);
}

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
    // Busca automações do tenant do armazenamento
    const automations = getAutomationsByTenant(req.tenantId);
    
    // Filtra apenas automações ativas
    const activeAutomations = automations.filter(auto => auto.status === 'active');
    
    res.json({
      success: true,
      data: activeAutomations,
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
    
    // Salva no armazenamento
    const newAutomation = {
      id: generateId(),
      tenant_id: req.tenantId,
      name,
      task,
      schedule,
      status: 'active',
      created_at: new Date().toISOString(),
      template_id: template_id || null
    };
    
    // Adiciona ao armazenamento
    automationsStorage.push(newAutomation);
    
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
    
    // Busca automação pelo ID e tenant (garante isolamento)
    const automation = getAutomationById(id, req.tenantId);
    if (!automation) {
      return res.status(404).json({ 
        success: false, 
        error: 'Automação não encontrada' 
      });
    }
    
    // Atualiza automação no armazenamento
    const index = automationsStorage.findIndex(auto => auto.id === id && auto.tenant_id === req.tenantId);
    if (index !== -1) {
      automationsStorage[index] = {
        ...automationsStorage[index],
        status: 'paused',
        paused_at: new Date().toISOString()
      };
    }
    
    const updatedAutomation = {
      ...automation,
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
    
    // Busca automação pelo ID e tenant (garante isolamento)
    const automation = getAutomationById(id, req.tenantId);
    if (!automation) {
      return res.status(404).json({ 
        success: false, 
        error: 'Automação não encontrada' 
      });
    }
    
    // Remove automação do armazenamento
    automationsStorage = automationsStorage.filter(auto => !(auto.id === id && auto.tenant_id === req.tenantId));
    
    res.json({
      success: true,
      data: automation,
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