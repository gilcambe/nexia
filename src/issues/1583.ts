import { CortexRepository } from '../repositories/cortexRepository';
import { D1 } from '../db/d1';

export class Issue1583 {
  private cortexRepository: CortexRepository;
  private d1: D1;

  constructor(cortexRepository: CortexRepository, d1: D1) {
    this.cortexRepository = cortexRepository;
    this.d1 = d1;
  }

  async processResponse(response: string, executionId: string): Promise<void> {
    // Process the response here (e.g., tokenize, analyze, etc.)

    // Save the final message to the database
    await this.cortexRepository.salvarMensagem(executionId, response);
  }
}
