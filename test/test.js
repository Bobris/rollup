require( 'source-map-support' ).install();
require( 'console-group' ).install();

var path = require( 'path' );
var sander = require( 'sander' );
var assert = require( 'assert' );
var babel = require( 'babel-core' );
var sequence = require( './utils/promiseSequence' );
var rollup = require( '../dist/rollup' );

var FUNCTION = path.resolve( __dirname, 'function' );
var FORM = path.resolve( __dirname, 'form' );
var SOURCEMAPS = path.resolve( __dirname, 'sourcemaps' );

var PROFILES = [
	{ format: 'amd' },
	{ format: 'cjs' },
	{ format: 'es6' },
	{ format: 'iife' },
	{ format: 'umd' }
];

function extend ( target ) {
	[].slice.call( arguments, 1 ).forEach( function ( source ) {
		source && Object.keys( source ).forEach( function ( key ) {
			target[ key ] = source[ key ];
		});
	});

	return target;
}

describe( 'rollup', function () {
	describe( 'sanity checks', function () {
		it( 'exists', function () {
			assert.ok( !!rollup );
		});

		it( 'has a rollup method', function () {
			assert.equal( typeof rollup.rollup, 'function' );
		});
	});

	describe( 'function', function () {
		sander.readdirSync( FUNCTION ).sort().forEach( function ( dir ) {
			if ( dir[0] === '.' ) return; // .DS_Store...

			var config;

			try {
				config = require( FUNCTION + '/' + dir + '/_config' );
			} catch ( err ) {
				config = { description: dir };
			}

			( config.skip ? it.skip : config.solo ? it.only : it )( dir, function () {
				var options = extend( {}, config.options, {
					entry: FUNCTION + '/' + dir + '/main.js'
				});

				if ( config.solo ) console.group( dir );

				return rollup.rollup( options )
					.then( function ( bundle ) {
						var unintendedError;

						if ( config.error ) {
							throw new Error( 'Expected an error while rolling up' );
						}

						// try to generate output
						try {
							var result = bundle.generate( extend( {}, config.bundleOptions, {
								format: 'cjs'
							}));

							if ( config.error ) {
								unintendedError = new Error( 'Expected an error while generating output' );
							}
						} catch ( err ) {
							if ( config.error ) {
								config.error( err );
							} else {
								unintendedError = err;
							}
						}

						if ( unintendedError ) throw unintendedError;

						var code;

						try {
							if ( config.babel ) {
								code = babel.transform( code, {
									whitelist: config.babel
								}).code;
							} else {
								code = result.code;
							}

							var fn = new Function( 'require', 'module', 'exports', 'assert', code );
							var module = {
								exports: {}
							};
							fn( require, module, module.exports, assert );

							if ( config.error ) {
								unintendedError = new Error( 'Expected an error while executing output' );
							}

							if ( config.exports ) {
								config.exports( module.exports );
							}
						} catch ( err ) {
							if ( config.error ) {
								config.error( err );
							} else {
								unintendedError = err;
							}
						}

						if ( config.show || unintendedError ) {
							console.log( code + '\n\n\n' );
						}

						if ( config.solo ) console.groupEnd();

						if ( unintendedError ) throw unintendedError;
					}, function ( err ) {
						if ( config.error ) {
							config.error( err );
						} else {
							throw err;
						}
					});
			});
		});
	});

	describe( 'form', function () {
		sander.readdirSync( FORM ).sort().forEach( function ( dir ) {
			if ( dir[0] === '.' ) return; // .DS_Store...

			describe( dir, function () {
				var config = require( FORM + '/' + dir + '/_config' );

				var options = extend( {}, config.options, {
					entry: FORM + '/' + dir + '/main.js'
				});

				var bundlePromise = rollup.rollup( options );

				PROFILES.forEach( function ( profile ) {
					( config.skip ? it.skip : config.solo ? it.only : it )( 'generates ' + profile.format, function () {
						if ( config.solo ) console.group( dir );

						return bundlePromise.then( function ( bundle ) {
							var options = extend( {}, config.options, {
								dest: FORM + '/' + dir + '/_actual/' + profile.format + '.js',
								format: profile.format
							});

							return bundle.write( options ).then( function () {
								var actualCode = sander.readFileSync( FORM, dir, '_actual', profile.format + '.js' ).toString().trim();
								var expectedCode;
								var actualMap;
								var expectedMap;

								try {
									expectedCode = sander.readFileSync( FORM, dir, '_expected', profile.format + '.js' ).toString().trim();
								} catch ( err ) {
									expectedCode = 'missing file';
								}

								try {
									actualMap = JSON.parse( sander.readFileSync( FORM, dir, '_actual', profile.format + '.js.map' ).toString() );
								} catch ( err ) {}

								try {
									expectedMap = JSON.parse( sander.readFileSync( FORM, dir, '_expected', profile.format + '.js.map' ).toString() );
								} catch ( err ) {}

								assert.equal( actualCode, expectedCode );
								assert.deepEqual( actualMap, expectedMap );

								if ( config.solo ) console.groupEnd();
							});
						});
					});
				});
			});
		});
	});

	describe( 'sourcemaps', function () {
		sander.readdirSync( SOURCEMAPS ).sort().forEach( function ( dir ) {
			if ( dir[0] === '.' ) return; // .DS_Store...

			describe( dir, function () {
				var config = require( SOURCEMAPS + '/' + dir + '/_config' );

				var options = extend( {}, config.options, {
					entry: SOURCEMAPS + '/' + dir + '/main.js'
				});

				var bundlePromise = rollup.rollup( options );

				PROFILES.forEach( function ( profile ) {
					( config.skip ? it.skip : config.solo ? it.only : it )( 'generates ' + profile.format, function () {
						return bundlePromise.then( function ( bundle ) {
							var result = bundle.generate({
								format: profile.format,
								sourceMap: true,
								sourceMapFile: 'bundle.js'
							});

							config.test( result.code, result.map );
						});
					});
				});
			});
		});
	});
});
