module.exports = [
	{
		description: 'Get who is in',
		method: 'GET',
		path: '/',
		fn: function(callback, args){
			var result = Homey.app.who();
			callback(result);
		}
	}
]