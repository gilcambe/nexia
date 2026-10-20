import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max } from 'class-validator';

export enum TaskStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export class CreateTaskRequest {
  @ApiProperty({
    description: 'Título da tarefa',
    example: 'Implementar autenticação JWT'
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Descrição detalhada da tarefa',
    example: 'Implementar sistema de autenticação usando JWT com expiração de 24 horas'
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Prioridade da tarefa',
    example: 5,
    minimum: 1,
    maximum: 10
  })
  @IsNumber()
  @Min(1)
  @Max(10)
  priority: number;

  @ApiProperty({
    description: 'ID do projeto ao qual a tarefa pertence',
    example: 'projeto-123'
  })
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({
    description: 'ID do usuário responsável pela tarefa',
    example: 'user-456'
  })
  @IsString()
  @IsOptional()
  assigneeId?: string;

  @ApiProperty({
    description: 'Status inicial da tarefa',
    enum: TaskStatus,
    example: TaskStatus.PENDING
  })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;
}
