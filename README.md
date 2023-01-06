# job.admin

system management tasks, like configuring iptables, ip management and routing

## getting started

## compiling

job.admin project use lots of code from rest.portal project.
follow below steps,
VERSION=$(read package.json and from dependencies section, rest.portal related version)

download, compile and npm link

```**sh**
    git clone git@gitlab.com:ferrumgate/rest.portal.git
    cd rest.portal
    git checkout $VERSION
    npm install && npm run build
    cd build/src
    npm link .
    
```

```**sh**
    cd job.admin
    npm link rest.portal@${VERSION}
    npm run build
```

# notes

lmdb library version is important. we are using `c` version 0.9.90 .
please dont upgrade lmdb version.
