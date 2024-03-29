/**
 * @summary base task interface
 */
export abstract class BaseTask {
    //does not throw exception
    public abstract start(): Promise<void>;
    //does not throw exception
    public abstract stop(): Promise<void>;
}