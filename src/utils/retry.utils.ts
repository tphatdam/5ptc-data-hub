export async function retryStep<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 5,
  delayMs: number = 3000,
  stepName: string = 'Step',
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      strapi.log.info(
        `${stepName} fail ${attempt}/${maxAttempts}: ${errorMessage}`,
      );
      
      if (attempt === maxAttempts) {
        throw error;
      }
      
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  
  throw new Error(`${stepName} failed after ${maxAttempts} attempts`);
}
