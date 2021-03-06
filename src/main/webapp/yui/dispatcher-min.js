/*
 Copyright (c) 2007, Caridy Patino. All rights reserved.
 Portions Copyright (c) 2007, Yahoo!, Inc. All rights reserved.
 Code licensed under the BSD License:
 http://www.bubbling-library.com/eng/licence
 version: 1.5.0
 */
YAHOO.namespace( "plugin" );
(function()
{
	var $C = YAHOO.util.Connect,$L = YAHOO.lang,$E = YAHOO.util.Event,$D = YAHOO.util.Dom,$ = YAHOO.util.Dom.get;
	var constants = {LOADING:1,DISPATCHED:2,ERROR:3,EMPTY:4,proxy:'/dispatcher.php?uri=',CSSNODE:1,JSNODE:2};
	var reScriptTag = /<script([^>]*)>([\s\S]*?)<\/script>/igm,reScriptTagSrc = /src=(['"]?)([^"']*)\1/i,reScriptTagRel = /rel=(['"]?)([^"']*)\1/i,reLinkTag = /<link([^>]*)(>[\s]*<\/link>|>)/igm,reLinkTagSrc = /href=(['"]?)([^"']*)\1/i,reStyleTag = /<style([^>]*)>([\s\S]*?)<\/style>/igm,reTagParams = new RegExp( '([\\w-\.]+)\\s*=\\s*(".*?"|\'.*?\'|\\w+)*',
			'im' );
	var reCSS3rdFile = new RegExp( 'url\\s*\\(([^\\)]*)', 'igm' );
	var reURI = new RegExp( '^((?:http|https)://)((?:\\w+[\.|-]?)*\\w+)(/.*)$', 'i' );
	YAHOO.plugin.Dispatcher = function()
	{
		var obj = {},_threads = {},_hashtable =
				[],_oDefaultConfig = {relative:false,baseURI:document.location},_loadingClass = 'loading',_classname = 'yui-dispatchable';

		function parseUri( str, strictMode )
		{
			var o = {key:["source","protocol","authority","userInfo","user","password","host","port","relative","path",
				"directory","file","query",
				"anchor"],q:{name:"queryKey",parser:/(?:^|&)([^&=]*)=?([^&]*)/g},parser:{strict:/^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,loose:/^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/}},m = o.parser[strictMode
					? "strict" : "loose"].exec( str ),uri = {},i = 14;
			while ( i-- )
			{
				uri[o.key[i]] = m[i] || "";
			}
			uri[o.q.name] = {};
			uri[o.key[12]].replace( o.q.parser, function( $0, $1, $2 )
			{
				if ($1)
				{
					uri[o.q.name][$1] = $2;
				}
			} );
			return uri;
		}

		;
		function _eraseQuotes( str )
		{
			if ($L.isString( str ))
			{
				str = str.replace( /^\s*(\S*(\s+\S+)*)\s*$/, "$1" );
				str = str.replace( /^(['|"])*(\S*(?:\s+\S+)*)\1$/, "$2" );
			}
			return str;
		}

		function _getParams( str, validator )
		{
			var p = null,r = {};
			validator = validator || {};
			if ($L.isString( str ))
			{
				while ( p = reTagParams.exec( str ) )
				{
					p[2] = (validator.hasOwnProperty( p[1] ) ? validator[p[1]] : p[2]);
					if (p[2])
					{
						r[p[1]] = _eraseQuotes( p[2] );
					}
					str = str.replace( reTagParams, '' );
				}
			}
			return r;
		}

		function _baseURI( uri )
		{
			uri = (($L.isString( uri ) && (uri.indexOf( '/' ) > -1)) ? uri : _oDefaultConfig.baseURI) + '';
			return uri.substr( 0, uri.lastIndexOf( '/' ) + 1 );
		}

		function _relativeURI( base, uri )
		{
			if (uri && !reURI.test( uri ) && (uri.indexOf( '/' ) !== 0))
			{
				uri = base + uri;
			}
			return uri;
		}

		function _onStart( config )
		{
			config.onStart = config.before || config.onStart;
			if ($L.isFunction( config.onStart ))
			{
				config.onStart.apply( config, [config.element] );
				config.onStart = null;
			}
			if (!config.underground && YAHOO.Bubbling)
			{
				YAHOO.Bubbling.fire( 'onAsyncRequestStart', {element:config.element} );
			}
		}

		function _onLoad( config )
		{
			config.onLoad = config.after || config.onLoad;
			if ($L.isFunction( config.onLoad ))
			{
				config.onLoad.apply( config, [config.element] );
			}
			if (!config.underground && YAHOO.Bubbling)
			{
				YAHOO.Bubbling.fire( 'onAsyncRequestEnd', {element:config.element} );
			}
		}

		function dispatch( hd, config )
		{
			var callback = null,flag = true,node = null,uri = '',i = 0;
			config = config || {};
			if (obj.isAlive( hd ))
			{
				node = _threads[hd].chunks.shift();
				if ($L.isObject( node ) && node.src)
				{
					config.hash = _hashtable.length;
					for ( i = 0; i < _hashtable.length; i++ )
					{
						if (_hashtable[i].uri == node.src)
						{
							if ((_hashtable[i].status == constants.DISPATCHED) && !config.override)
							{
								flag = false;
							}
							else
							{
							}
							config.hash = i;
							break;
						}
					}
					if (flag)
					{
						uri = obj.firewall( node.src, config, true );
						if ($L.isString( uri ) && (uri !== ''))
						{
							_hashtable[config.hash] = {uri:node.src,proxy:uri,status:constants.LOADING};
							if (node.type === constants.JSNODE)
							{
								obj.area = hd;
								obj.destroyer = _threads[hd].destroyer;
								config.handle = YAHOO.util.Get.script( uri, {onSuccess:function()
								{
									_hashtable[config.hash].status = constants.DISPATCHED;
									if (config.rel && YAHOO.Bubbling)
									{
										YAHOO.Bubbling.fire( 'onScriptReady',
												{module:node.rel,src:node.src,uri:uri,hash:config.hash} );
									}
									config.hash = null;
									dispatch( hd, config );
								},onFailure:function()
								{
									dispatch( hd, config );
								},scope:obj,data:config} );
							} else if (node.type === constants.CSSNODE)
							{
								YAHOO.util.Get.css( uri, {} );
								_hashtable[config.hash].status = constants.DISPATCHED;
								dispatch( hd, config );
							}
						}
					}
					else
					{
						dispatch( hd, config );
					}
				}
				else
				{
					config.hash = null;
					exec( hd, node.content, config );
				}
			}
			else
			{
				obj.kill( hd );
				_onLoad( config );
			}
		}

		function exec( hd, c, config )
		{
			var status = constants.EMPTY;
			if (c && (c !== ''))
			{
				config.scope = (config.scope ? config.scope : window);
				try
				{
					status = constants.DISPATCHED;
					this.scriptScope = null;
					if (!config.hash || (_hashtable[config.hash].status != constants.DISPATCHED))
					{
						obj.area = hd;
						obj.destroyer = _threads[hd].destroyer;
						if ($L.isFunction( config.evalRoutine ))
						{
							this.scriptScope = config.evalRoutine( c, config );
						}
						else
						{
							this.scriptScope =
									new (new Function( '_container_', c + '; return this;' ))( config.scope );
						}
					}
				}
				catch( e )
				{
					status = constants.ERROR;
					if ($L.isFunction( config.error ))
					{
						config.error.apply( config, [hd,c,_hashtable] );
					}
					else
					{
						throw new Error( "Dispacher: Script Execution Error (" + e + ")" );
					}
				}
			}
			if ($L.isNumber( config.hash ))
			{
				_hashtable[config.hash].status = status;
				config.hash = null;
			}
			dispatch( hd, config );
		}

		function display( el, c, config )
		{
			config.action = (config.action ? config.action : 'replace');
			switch ( config.action )
			{
				case'tabview':
					destroy( el.get( 'contentEl' ), config );
					try
					{
						el.set( 'content', c );
					}
					catch( e1 )
					{
						return false;
					}
					break;
				case'update':
					c = el.innerHTML + c;
					try
					{
						el.innerHTML = c;
					}
					catch( e2 )
					{
						return false;
					}
					break;
				case'replace':
				default:
					destroy( el, config );
					try
					{
						el.innerHTML = c;
					}
					catch( e3 )
					{
						return false;
					}
					break;
			}
			return true;
		}

		function destroy( el, config )
		{
			var hd = config.guid,i = 0;
			if ($L.isObject( _threads[hd].destroyer ))
			{
				_threads[hd].destroyer.fire( el, config );
			}
			if ($D.inDocument( el ))
			{
				for ( i = 0; i < el.childNodes.length; i++ )
				{
					$E.purgeElement( el.childNodes[i], true );
				}
			}
			$D.addClass( el, _classname );
			_threads[hd].destroyer = new YAHOO.util.CustomEvent( 'destroyer' );
			if ($L.isFunction( config.onDestroy ))
			{
				_threads[hd].destroyer.subscribe( config.onDestroy );
			}
		}

		function parse( hd, s, config )
		{
			config = config || {};
			config.uri = config.uri || null;
			config.relative = config.relative || _oDefaultConfig.relative;
			var m = true,attr = false,base = _baseURI( config.uri );
			s = s.replace( reStyleTag, function( str, p1, p2, offset, s )
			{
				if (p2)
				{
					obj.applyCSS( p2, _getParams( p1 ), config );
				}
				return"";
			} );
			s = s.replace( reLinkTag, function( str, p1, p2, offset, s )
			{
				if (p1)
				{
					attr = p1.match( reLinkTagSrc );
					if (attr)
					{
						if (config.relative)
						{
							attr[2] = _relativeURI( base, attr[2] );
						}
						_threads[hd].chunks.push( {src:attr[2],content:'',type:constants.CSSNODE,params:_getParams( p1 )} );
					}
				}
				return"";
			} );
			s = s.replace( reScriptTag, function( str, p1, p2, offset, s )
			{
				if (p1)
				{
					attr = p1.match( reScriptTagSrc );
					if (attr)
					{
						var rel = p1.match( reScriptTagRel );
						rel = (rel ? rel[2] : null);
						if (config.relative)
						{
							attr[2] = _relativeURI( base, attr[2] );
						}
						_threads[hd].chunks.push( {src:attr[2],content:'',type:constants.JSNODE,rel:rel,params:_getParams( p1 )} );
					}
				}
				if (p2)
				{
					_threads[hd].chunks.push( {src:null,content:p2,type:constants.JSNODE,params:_getParams( p1 )} );
				}
				return"";
			} );
			return s;
		}

		if (YAHOO.Bubbling)
		{
			YAHOO.Bubbling.on( 'onScriptReady', function()
			{
				if (this.src && !this.hash)
				{
					_hashtable[this.hash].status = constants.DISPATCHED;
				}
			} );
		}
		obj.area = null;
		obj.strictMode = true;
		obj.destroyer = null;
		obj.fetch = function( el, uri, config )
		{
			config = config || {};
			config.uri = uri;
			var callback = {success:function( o )
			{
				if (o.responseText != 'undefined')
				{
					obj.process( el, o.responseText, config, true );
				}
				$D.removeClass( el, _loadingClass );
			},failure:function( o )
			{
				if ($L.isFunction( config.onError ))
				{
					config.onError.apply( config, [config.element] );
				}
				$D.removeClass( el, _loadingClass );
			}};
			if (uri)
			{
				uri = obj.firewall( uri, config );
				$D.addClass( el, _loadingClass );
				config.handle = $C.asyncRequest( 'GET', uri, callback );
				config.element = el;
				_onStart( config );
				return config.handle;
			}
			return null;
		};
		obj.process = function( el, content, config, flag )
		{
			var hd = null;
			config = config || {};
			if ($L.isObject( el ) || (el = $( el )))
			{
				hd = config.guid || $E.generateId( el );
				this.kill( hd );
				config.element = el;
				config.content = content;
				config.guid = hd;
				if (!flag)
				{
					_onStart( config );
				}
				if (display( el, parse( hd, content, config ), config ))
				{
					dispatch( hd, config );
				}
			}
			return hd;
		};
		obj.delegate = function( tab, tabview, config )
		{
			config = config || {};
			config.action = 'tabview';
			config.uri = tab.get( 'dataSrc' ) || null;
			config.tab = tab;
			tab.loadHandler.success = function( o )
			{
				var el = tab.get( 'contentEl' );
				config.tab = el;
				config.underground = true;
				obj.process( tab, o.responseText, config );
				if (YAHOO.Bubbling)
				{
					YAHOO.Bubbling.fire( 'onAsyncRequestEnd', {element:el} );
				}
			};
			tab.on( "activeChange", function()
			{
				if (YAHOO.Bubbling && this.get( 'active' ) && tab.get( 'dataSrc' ) && !this.get( 'cacheData' ))
				{
					YAHOO.Bubbling.fire( 'onAsyncRequestStart', {element:this.get( 'contentEl' )} );
				}
			} );
			if ($L.isObject( tabview ))
			{
				tabview.addTab( tab );
			}
		};
		obj.applyCSS = function( cssCode, params, config )
		{
			params = params || {};
			var styleElement = document.createElement( "style" ),base = params.href || '';
			config = config || {};
			config.uri = config.uri || _oDefaultConfig.baseURI;
			config.relative = config.relative || _oDefaultConfig.relative;
			if (config.relative)
			{
				base = _baseURI( config.uri );
				base = _relativeURI( base, params.href );
			}
			base = _baseURI( base );
			cssCode = cssCode.replace( reCSS3rdFile, function( str, p1, offset, s )
			{
				p1 = _eraseQuotes( p1 );
				p1 = 'url(' + _relativeURI( base, p1 );
				return p1;
			} );
			styleElement.type = "text/css";
			if ($L.isObject( styleElement.styleSheet ))
			{
				styleElement.styleSheet.cssText = cssCode;
			}
			else
			{
				styleElement.appendChild( document.createTextNode( cssCode ) );
			}
			try
			{
				document.getElementsByTagName( "head" )[0].appendChild( styleElement );
			}
			catch( e )
			{
				throw new Error( "Dispacher: CSS Processing Error (" + e + ")" );
				return false;
			}
			return true;
		};
		obj.jsLoader = function( uri, config )
		{
			if ($L.isString( uri ) && (uri !== ''))
			{
				config = config || {};
				$E.generateId( config );
				obj.kill( config.id );
				_threads[config.id].chunks = [
					{src:uri,content:'',type:constants.JSNODE,params:{href:uri}}
				];
				config.underground = true;
				_onStart( config );
				dispatch( config.id, config );
				return config.id;
			}
			return null;
		};
		obj.cssLoader = function( uri, config )
		{
			if ($L.isString( uri ) && (uri !== ''))
			{
				config = config || {};
				$E.generateId( config );
				obj.kill( config.id );
				_threads[config.id].chunks = [
					{src:uri,content:'',type:constants.CSSNODE,params:{href:uri}}
				];
				config.underground = true;
				_onStart( config );
				dispatch( config.id, config );
				return config.id;
			}
			return null;
		};
		obj.isAlive = function( hd )
		{
			return(hd && $L.isObject( _threads[hd] ) && (_threads[hd].chunks.length > 0));
		};
		obj.kill = function( hd )
		{
			if (hd && !$L.isObject( _threads[hd] ))
			{
				_threads[hd] = {chunks:[],destroyer:null};
			} else if (this.isAlive( hd ))
			{
				_threads[hd].chunks = [];
			}
		};
		obj.destroy = function( hd )
		{
			this.kill( hd );
			if (hd && !$L.isObject( _threads[hd] ))
			{
				_threads[hd].destroyer.fire( $( hd ), {} );
			}
		};
		obj.onDestroy = function( hd, bh, scope )
		{
			var params = (scope ? [bh,scope,true] : [bh]);
			if ($L.isObject( _threads[hd] ) && $L.isObject( _threads[hd].destroyer ))
			{
				if ($L.isObject( scope ))
				{
					_threads[hd].destroyer.subscribe( bh, scope, true );
				}
				else
				{
					_threads[hd].destroyer.subscribe( bh );
				}
				return true;
			}
			return false;
		};
		obj.init = function( c )
		{
			c = c || {};
			c.relative = c.relative || false;
			_oDefaultConfig = c;
		};
		obj.firewall = function( uri, config, monolitic )
		{
			var sDomain = null,sProtocol = null,m = null;
			while ( uri.indexOf( '&amp;' ) > -1 )
			{
				uri = uri.replace( '&amp;', '&' );
			}
			config.proxy = config.proxy || constants.proxy;
			if ($L.isFunction( config.firewall ))
			{
				uri = config.firewall.apply( config, [uri] );
			}
			else
			{
				if (!config.monolithic && !monolitic && config.proxy)
				{
					m = uri.match( reURI );
					if (m && (m[2] !== document.domain))
					{
						uri = config.proxy + escape( uri );
					}
				}
			}
			return uri;
		};
		obj.augmentURI = function( url, m )
		{
			m = m || {};
			var o = parseUri( url, this.strictMode ),u = '';
			o.queryKey = o.queryKey || {};
			$L.augmentObject( o.queryKey, m, true );
			if (o.protocol)
			{
				u += o.protocol + ':';
			}
			if (this.strictMode)
			{
				if (/^(?:[^:\/?#]+:)?\/\//.test( o.source ))
				{
					u += '//';
				}
			}
			else
			{
				if (/^(?:(?![^:@]+:[^:@\/]*@)[^:\/?#.]+:)?\/\//.test( o.source ))
				{
					u += '//';
				}
			}
			if (o.authority)
			{
				if (o.userInfo)
				{
					if (o.user)
					{
						u += o.user;
					}
					if (o.userInfo.indexOf( ':' ) > -1)
					{
						u += ':';
					}
					if (o.password)
					{
						u += o.password;
					}
					u += '@';
				}
				if (o.host)
				{
					u += o.host;
				}
				if (o.port)
				{
					u += ':' + o.port;
				}
			}
			if (o.relative)
			{
				if (o.path)
				{
					if (o.directory)
					{
						u += o.directory;
					}
					if (o.file)
					{
						u += o.file;
					}
				}
				u += '?';
				for ( sName in o.queryKey )
				{
					if (o.queryKey.hasOwnProperty( sName ))
					{
						u += sName + '=' + o.queryKey[sName] + '&';
					}
				}
				if (o.anchor)
				{
					u += '#' + o.anchor;
				}
			}
			return u;
		};
		obj.toString = function()
		{
			return("Dispatcher Manager Plugin (Singlenton)");
		};
		return obj;
	}();
})();
YAHOO.util.Dispatcher = YAHOO.plugin.Dispatcher;
YAHOO.register( "dispatcher", YAHOO.plugin.Dispatcher, {version:"1.5.0",build:"218"} );