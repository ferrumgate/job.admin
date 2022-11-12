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

    /**
     * @summary creates a random string with 6 length
     * @remark this code comes from rest.portal
     */
    static randomNumberString(string_length: number = 16) {
        var chars = "0123456789abcdefghiklmnopqrstuvwxyzABCDEFGHIKLMNOPQRSTUVWXYZ";

        var randomstring = '';
        for (var i = 0; i < string_length; i++) {
            var rnum = Math.floor(Math.random() * chars.length);
            randomstring += chars.substring(rnum, rnum + 1);
        }
        return randomstring;
    }
}