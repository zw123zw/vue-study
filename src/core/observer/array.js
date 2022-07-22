/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import {
	def
} from '../util/index'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)
// 这里是创建个对象，让对象原型指向数组原型
// Object.create(proto，[propertiesObject])
// Object.create()方法创建一个新对象，使用现有的对象来提供新创建的对象的__proto __
// proto
// 新创建对象的原型对象。
// propertiesObject
// 可选。需要放置一个对象，该对象的属性类型参照Object.defineProperties()的第二个参数。如果该参数被指定且不为undefined，该变量对象的自有可枚举属性（即其自身定义的属性，而不是其原型链上的枚举属性）将为新创建的对象添加指定的属性值和对应的属性设定。

const methodsToPatch = [
	'push',
	'pop',
	'shift',
	'unshift',
	'splice',
	'sort',
	'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function(method) {
	// cache original method
	const original = arrayProto[method]
	// 重写数组原型方法
	def(arrayMethods, method, function mutator(...args) {
		const result = original.apply(this, args)
		//在Observer初始化时设置了def(value, '__ob__', this) ,所以这里的this.__ob__代表的是Observer
		const ob = this.__ob__
		let inserted
		switch (method) {
			case 'push':
			case 'unshift':
				inserted = args
				break
			case 'splice':
				inserted = args.slice(2)
				break
		}
		if (inserted) ob.observeArray(inserted) //当插入数据时，使用Observer将数据变为响应数据
		// notify change
		ob.dep.notify()
		return result
	})
})
