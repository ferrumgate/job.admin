
/**
 * base task interface
 */
export abstract class BaseTask {
    public abstract start(): Promise<void>;
    public abstract stop(): Promise<void>;
}