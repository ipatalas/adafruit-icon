#!/usr/bin/env node

'use strict'

const fs = require('fs')
const path = require('path')
const Stream = require('stream')
const PNG = require('pngjs').PNG
const program = require('commander')

program
	.version(require('./package.json').version)
	.usage('[FILE]...')
	.option('-b, --background-color <bgColor>', 'Background color for transparent areas', /^\d+(,\d+){2}$/, '0,0,0')
	.parse(process.argv)

if (!program.args.length) {
	return program.help()
}

const invalidChars = /[^\w]/g
const bgColor = program.backgroundColor.split(',').map(x => parseInt(x))

processImages()

async function processImages() {
	try {
		for (let filepath of program.args) {
			await convertImage(filepath)
		}
	} catch (err) {
		console.error(err)
	}
}

function convertImage(filepath) {
	const imageName = path.parse(filepath).name.replace(invalidChars, '')

	return new Promise((resolve, reject) => {
		fs.createReadStream(filepath)
			.on('error', reject)
			.pipe(new PNG())
			.on('error', reject)
			.on('parsed', function () {
				const output = fs.createWriteStream(`${imageName}.h`, { encoding: 'ascii' })
				output.write('#include <pgmspace.h>\n\n')
				output.write(`const uint16_t ${imageName}Width = ${this.width};\n`)
				output.write(`const uint16_t ${imageName}Height = ${this.height};\n\n`)
				output.write(`const unsigned short ${imageName}[${this.width * this.height}] PROGMEM = {\n`)

				for (var y = 0; y < this.height; y++) {
					const row = []

					for (var x = 0; x < this.width; x++) {
						const idx = (this.width * y + x) << 2
						const r = this.data[idx]
						const g = this.data[idx + 1]
						const b = this.data[idx + 2]
						const a = this.data[idx + 3]

						row.push(convertColor(r, g, b, a))
					}

					output.write(row.join(','))
					if (y === this.height - 1) {
						output.end('};')
					}
					else {
						output.write(',\n')
					}
				}

				resolve()
			})
	})
}

function convertColor(r, g, b, a) {
	a = a / 255
	r = Math.round((1 - a) * bgColor[0] + a * r)
	g = Math.round((1 - a) * bgColor[1] + a * g)
	b = Math.round((1 - a) * bgColor[2] + a * b)

	return rgb565(r, g, b)
}

// Adafruit is using RGB565 https://learn.adafruit.com/adafruit-gfx-graphics-library/coordinate-system-and-units
function rgb565(r, g, b) {
	return '0x' + ((r / 255 * 31) << 11 | (g / 255 * 63) << 5 | (b / 255 * 31)).toString(16)
}
