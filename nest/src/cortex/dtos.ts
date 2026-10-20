import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsNotEmpty, IsOptional, IsBoolean, IsDateString } from 'class-validator';

// DTOs para o módulo Cortex - implementados conforme requisitos

export enum TaskStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
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
    enum: TaskPriority,
    enumName: 'TaskPriority',
    required: false,
  })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiProperty({
    description: 'Indica se a tarefa é recorrente',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiProperty({
    description: 'Status da tarefa',
    example: 'PENDING',
    enum: TaskStatus,
    enumName: 'TaskStatus',
    required: false,
  })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty({
    description: 'Data de início planejada',
    example: '2024-01-15T10:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  plannedStartDate?: string;

  @ApiProperty({
    description: 'Data de conclusão planejada',
    example: '2024-01-20T18:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  plannedEndDate?: string;
}
