import { dir } from 'console';
import lmdb from 'lmdb';

/**
 * @summary lmdb database
 */
export class LmdbService {
    /**
     *
     */
    static rootDatabases: Map<string, lmdb.RootDatabase> = new Map();
    database!: lmdb.Database;
    constructor(database: lmdb.Database) {
        this.database = database;
    }
    static async close() {
        for (const root of LmdbService.rootDatabases.values()) {
            await root.close();
        }
        this.rootDatabases.clear();
    }
    static async open(name: string, dirname: string = '.', encoding: 'msgpack' | 'json' | 'string' | 'binary' | 'ordered-binary' = 'string', maxDb = 24,
        maxSize = 1073741824, dupSort = false,
    ): Promise<LmdbService> {
        if (!LmdbService.rootDatabases.has(dirname)) {
            const rootDatabase = lmdb.open(dirname, {
                maxReaders: 512,
                mapSize: maxSize,
                maxDbs: maxDb,
                dupSort: dupSort,
                encoding: encoding
            })
            LmdbService.rootDatabases.set(dirname, rootDatabase);
        }
        const rootDatabase = LmdbService.rootDatabases.get(dirname) as lmdb.RootDatabase;

        const database = rootDatabase.openDB(
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
        return await this.database.batch(async () => {
            await action()
        });
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