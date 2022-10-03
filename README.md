# oe-skeleton project 

A scaffold project of oe-cloud.

## dependency
* oe-cloud
* oe-logger

## Installation, test cases and code coverage

### Pre-requisite

- you should able to connecto to [npmjs](http://registry.npmjs.org) and [github](https://github.com) when you use npm on command line
- For that use .npmrc and .gitconfig as shown below

*.npmrc*

```
http-proxy=http://<username>:<password>@proxyip:proxyport/
https-proxy=http://<username>:<password>@proxyip:proxyport/
registry="http://registry.npmjs.org"
no_proxy=
strict-ssl=false
python=E:\Python27\python.exe
```

*.gitconfig*

```
[http]
proxy = http://<username>:<password>@proxyip:proxyport/
[https]
proxy = http://<username>:<password>@proxyip:proxyport/
[http "http://noproxyip:port"]
    sslVerify = false
    proxy =
[user]
	name = username
	email = username@domain.com
```

### README.md

you should change this file as per your module.

### ESLint

.eslintrc and .eslintignore files you need not to modify. However it is good practice to run following command before you push into git. Or else CI/CD pipeline will fail.

```sh
$ eslint . --fix
```

## Developing oe-cloud module

You can do following things in this oe-cloud module.

* Add models specific to your module (see common/modles folder)
* Add mixins which will get attached to BaseEntity (see common/mixins folder)
* Add middleware (see server/middleware folder and server/middleware.json)
* Add Boot script (see server/boot folder)


### datasources*.json 

There are several total 3 datasource.x.json files each for Mongo, PostgreSQL and Oracle. you should change database name at least for Mongo and PostgreSQL

### server.js

you may want to run this module as independent server during your development.  Mostly you don't have to chagne this file unless you are having mixin. For that have line similar to below for your mixin.

```javascript
oecloud.attachMixinsToBaseEntity("SkeletonMixin");

```
