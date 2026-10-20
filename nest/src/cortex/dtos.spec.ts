import { validate } from 'class-validator';
import { CreateTaskRequest, TaskStatus, TaskPriority } from './dtos';

describe('CreateTaskRequest DTO', () => {
  it('deve ser válido com dados corretos', async () => {
    const dto = new CreateTaskRequest();
    dto.title = 'Título da tarefa';
    dto.description = 'Descrição da tarefa';
    dto.priority = TaskPriority.HIGH;
    dto.isRecurring = false;
    dto.status = TaskStatus.PENDING;
    dto.scheduledAt = '2024-01-15T10:00:00Z';
    
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('deve ser válido com dados mínimos', async () => {
    const dto = new CreateTaskRequest();
    dto.title = 'Título da tarefa';
    
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('deve falhar sem título', async () => {
    const dto = new CreateTaskRequest();
    
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('title');
  });

  it('deve aceitar status válido', async () => {
    const dto = new CreateTaskRequest();
    dto.title = 'Título da tarefa';
    dto.status = TaskStatus.IN_PROGRESS;
    
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('deve aceitar prioridade válida', async () => {
    const dto = new CreateTaskRequest();
    dto.title = 'Título da tarefa';
    dto.priority = TaskPriority.LOW;
    
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('deve aceitar data válida', async () => {
    const dto = new CreateTaskRequest();
    dto.title = 'Título da tarefa';
    dto.scheduledAt = '2024-01-15T10:00:00Z';
    
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('deve rejeitar data inválida', async () => {
    const dto = new CreateTaskRequest();
    dto.title = 'Título da tarefa';
    dto.scheduledAt = 'data inválida';
    
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('scheduledAt');
  });

  it('deve aceitar todos os valores do TaskStatus', async () => {
    const statuses = [TaskStatus.PENDING, TaskStatus.QUEUED, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.FAILED];
    
    for (const status of statuses) {
      const dto = new CreateTaskRequest();
      dto.title = 'Título da tarefa';
      dto.status = status;
      
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('deve aceitar todos os valores do TaskPriority', async () => {
    const priorities = [TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH];
    
    for (const priority of priorities) {
      const dto = new CreateTaskRequest();
      dto.title = 'Título da tarefa';
      dto.priority = priority;
      
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });
});
