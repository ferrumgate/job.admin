import childprocess from 'child_process';

export class Util {
    static async sleep(microseconds: number) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve('timeout');
            }, microseconds)
        })
    }

    static async exec(cmd: string) {
        return new Promise((resolve, reject) => {
            childprocess.exec(cmd, (error, stdout, stderr) => {
                if (error)
                    reject(error);
                else
                    if (stderr)
                        reject(stderr);
                    else
                        if (stdout)
                            resolve(stdout);
                        else
                            resolve('');

            })
        })
    }
}