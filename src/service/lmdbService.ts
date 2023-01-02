import lmdb from 'lmdb';

export class LmdbService {
    /**
     *
     */
    static rootDatabase: lmdb.RootDatabase | null;
    database!: lmdb.Database;
    constructor(database: lmdb.Database) {
        this.database = database;
    }
    static async close() {
        if (this.rootDatabase)
            await this.rootDatabase.close();
        LmdbService.rootDatabase = null;
    }
    static async open(name: string, dirname?: string, encoding: 'msgpack' | 'json' | 'string' | 'binary' | 'ordered-binary' = 'msgpack', maxDb = 3,
        maxSize = 1073741824, dupSort = false,
    ): Promise<LmdbService> {
        if (!LmdbService.rootDatabase) {
            LmdbService.rootDatabase = lmdb.open(dirname || '.', {
                mapSize: maxSize,
                maxDbs: maxDb,
                dupSort: dupSort,
                encoding: encoding
            })
        }

        const database = LmdbService.rootDatabase.openDB(
            {
                name: name,
            }
        )
        return new LmdbService(database);

    }
    async clear() {

        await this.database.clearAsync();

    }
    async drop() {
        await this.database.drop();
    }

    async close() {
        if (this.database)
            await this.database.close()

    }
    async batch(action: () => Promise<void>) {
        return await this.database.batch(action);
    }
    async get<T>(key: lmdb.Key) {
        return this.database.get(key) as T;
    }
    async put(key: lmdb.Key, value: any) {
        return await this.database.put(key, value);

    }
    async remove(key: lmdb.Key) {
        return await this.database.remove(key);
    }
    async transaction(action: () => Promise<void>) {
        return this.database.transaction(async () => {
            await action();
        });
    }
    async range(option?: lmdb.RangeOptions) {
        return await this.database.getRange(option)
    }




}