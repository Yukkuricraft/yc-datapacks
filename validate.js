const mc116 = require('@mcschema/java-1.16')
const fs = require('fs/promises')
const DataModel = require('@mcschema/core/lib/model/DataModel.js').DataModel
const i18n = require('@mcschema/locales/src/en.json')

const verbose = process.argv.length >= 2 && process.argv[2] === '-v'

async function validate(schema, file) {
	const content = await fs.readFile(file, {encoding: 'utf8'})
	const data = JSON.parse(content)

	const model = new DataModel(schema)
	model.data = data

	model.validate(false)
	return model.errors
}

function format(str, params) {
	let formatted = i18n[str] ?? str

	if (params) {
		formatted = formatted.replace(/%\d+%/g, substring => {
			const i = Number(substring.slice(1, -1))
			return params[i] ?? substring
		})
	}

	return formatted
}

function printError(error) {
	const errorStr = format(error.error, error.params)

	if (verbose) {
		console.error(
			`\x1b[31m[error] ${errorStr}` + '\n' +
			`[error] Found ${JSON.stringify(error.path.get())} at ${error.path}` + '\n' +
			`[error]\x1b[0m`
		)
	} else {
		console.error(errorStr)
	}
}

async function validateType(schemas, path, type, schemaName, extension) {
	extension = extension ?? 'json'
	const schema = schemas.get(schemaName)
	const file = `${path}/${type}`

	try {
		await fs.access(file)
	} catch (e) {
		return
	}

	let foundErrors = false

	for (const typeFile of await fs.readdir(`${path}/${type}`)) {
		if (typeFile.endsWith('.' + extension)) {
			const errors = await validate(schema, `${path}/${type}/${typeFile}`)

			if (errors.count() > 0) {
				console.error(`Errors for ${path}/${type}/${typeFile}`)
				foundErrors = true
			} else {
				if (verbose) {
					console.log(`\x1b[32m[success] Validated ${path}/${type}/${typeFile}\x1b[0m`)
				} else {
					console.log(`Validated ${path}/${type}/${typeFile}`)
				}
			}

			for (const error of errors) {
				printError(error)
			}

			if (errors.count() > 0) {
				if (verbose) {
					console.log(`\x1b[31m[error] Found ${errors.count()} errors\x1b[0m`)
				}
				console.log()
			}
		}
	}

	return foundErrors
}

async function run(packFolder) {
	const collections = mc116.getCollections()
	collections.register('loot_condition_type', [])
	collections.register('loot_function_type', [])
	collections.register('worldgen/structure_feature', [])

	let loadItems = true
	try {
		await fs.access('items.txt')
	} catch (e) {
		loadItems = false
	}

	if (loadItems) {
		const itemsStr = await fs.readFile('items.txt', {encoding: "utf8"})
		collections.register('item', itemsStr.trim().split('\n'))
	} else {
		collections.register('item', [])
	}

	const schemas = mc116.getSchemas(collections)
	let foundErrors = false

	for (const namespace of await fs.readdir(`${packFolder}/data`)) {
		if (namespace === 'minecraft') {
			continue
		}

		const namespaceFolder = `${packFolder}/data/${namespace}`

		function processType(type, schemaName, extension) {
			const res = validateType(schemas, namespaceFolder, type, schemaName, extension)
			foundErrors = foundErrors || res
		}

		processType('advancements', 'advancement')

		//validateType(namespaceFolder, 'functions', 'mc_function') TODO Find this later
		//validateType(namespaceFolder, 'item_modifiers') TODO Find this later

		processType('loot_tables', 'loot_table')
		processType('predicates', 'predicate')
		processType('recipes', 'recipe')
		processType('tags/blocks', 'block_tag')
		processType('tags/entity_types', 'entity_type_tag')
		processType('tags/fluids', 'fluid_tag')
		processType('tags/functions', 'function_tag')
		processType('tags/items', 'item_tag')
		processType('dimension', 'dimension')
		processType('dimension_type', 'dimension_type')
		processType('worldgen/biome', 'biome')
		processType('worldgen/configured_carver', 'configured_carver')
		processType('worldgen/configured_feature', 'configured_feature')
		processType('worldgen/configured_structure_feature', 'configured_structure_feature')
		processType('worldgen/configured_surface_builder', 'configured_surface_builder')
		processType('worldgen/noise_settings', 'noise_settings')
		processType('worldgen/processor_list', 'processor_list')
		processType('worldgen/template_pool', 'template_pool')
	}

	return foundErrors
}

let encounteredPack = false

for(const arg of process.argv.splice(2)) {
	if (arg.startsWith("-")) {
		continue
	}

	encounteredPack = true
	run(arg)
}

if(!encounteredPack) {
	run('datapacks/yukkuricraft')
}
