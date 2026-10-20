import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

// DTOs para o módulo Cortex - implementados conforme requisitos

export enum TaskStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export class CreateTaskRequest {
  @ApiProperty({
    description: 'Título da tarefa',
    example: 'Implementar nova funcionalidade',
  })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Descrição detalhada da tarefa',
    example: 'Implementar a nova funcionalidade de relatórios com exportação para PDF',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Prioridade da tarefa',
    example: 'high',
    required: false,
  })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiProperty({
    description: 'Indica se a tarefa é recorrente',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiProperty({
    description: 'Data de agendamento para tarefas recorrentes',
    example: '2024-01-15T10:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsString()
  scheduledAt?: string;
}
