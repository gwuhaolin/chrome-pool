# 浏览器环境ULS日志上报库
建立在[ULS](http://uls.server.com)之上的浏览器日志上报服务。

## 使用场景
- 实时日志（ULS系统延迟10s左右）
- 延迟上报（通过indexedDB缓存日志，依赖浏览器支持indexedDB）
- 抽样上报（可设置随机上报概率）
- 海量日志（建立在ULS上）
- 数据量大的日志 （自动把数据量大的日志拆分成多条上报）
- 只能用于浏览器环境，Nodejs环境直接使用[imlog](http://git.code.oa.com/imweb/imlog.git)

## 安装
```bash
tnpm i @tencent/imweblog
```

## 使用

#### 初始化
```js
import {info,error,init} from '@tencent/imweblog';

// 设置项目使用的默认配置
init({
    // 日志所属模块,各个项目使用一个唯一值,一定不要忘记设置这个
    module: 'test_module',
    // 是否立即上报，不用立即上报的会被缓存起来延后上报, 默认是 立即上报
    immediately: false,
    // 是否抽样上报，该条的上报的概率是多少？ 0～1 之间，默认是 全部上报
    sample: 1,
    // 是否自动上报缓存在DB里的日志
    // 大于0说明没隔autoFlushCachedLog秒检查缓存的日志自动上报情况缓存
    // <=0 说明不自动检查缓存
    autoFlushCachedLog:10,
    // 在不支持 IndexDB 缓存日志时 怎么处理需要被缓存的日志 ？
    // 默认采用 直接上报给 ULS,不做缓存。
    unSupportCacheLogHandler:(log)=>{
      
    }
});
```

#### 上报
```js
info('字符串类型的日志内容');
```

#### 上报时设置当前参数
```js
info('字符串类型的日志内容',{
    // 日志所属模块,各个项目使用一个唯一值
    module: 'test_module',
    // 是否立即上报，不用立即上报的会被缓存起来延后上报, 默认是 立即上报
    immediately: false,
    // 是否抽样上报，该条的上报的概率是多少？ 0～1 之间，默认是 全部上报
    sample: 1,
});
```

#### 支持的配置参数
- `module`: 日志所属模块,各个项目使用一个唯一值
- `immediately`: 是否立即上报，不用立即上报的会被缓存起来延后上报, 默认是 立即上报
- `sample`: 是否抽样上报，该条的上报的概率是多少？ 0～1 之间，默认是 全部上报
- `cacheTTL`: 被缓存的日志的最大生存时间，单位ms，超过了时间的缓存日志将被丢弃. 只在 immediately==false 时生效，默认永远不丢弃

所有支持的配置参数默认使用`init`里的，单独的上报语句里可以覆盖

#### 支持的日志等级
- `info`
- `error`

#### 手动清空缓存
要手动情况缓存，先关闭自动清空模式
```js
import {init,flushCachedLog} from '@tencent/imweblog';
init({
    autoFlushCachedLog:0,
});
```
再手动上报缓存并且清空缓存
```js
flushCachedLog();
```


## 查询日志
1. 打开[ULS](http://uls.server.com)
2. 在搜索栏里，增加筛选条件 `包含关键字`=`imweblog-server && module` 
3. 选好对应的时间，点击查询

## 开发
- 执行`npm run dev`后在浏览器里调试
- 更新版本后，执行`npm run pub`发布到tnpm
- 服务端 [imweblog-server](http://git.code.oa.com/imweb/imweblog-server)
