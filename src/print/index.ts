import * as acorn from 'acorn';
import * as astring from 'astring';
import * as SourceMap from 'source-map';
import * as perisopic from 'periscopic';
import { walk } from 'estree-walker';
import is_reference from 'is-reference';

type PrintOptions = {
	file?: string;
	getName?: (name: string) => string;
};

function deconflict(name: string, names: Set<string>) {
	const original = name;
	let i = 1;

	while (names.has(name)) {
		name = `${original}$${i++}`;
	}

	return name;
}

export function print(node: acorn.Node, opts: PrintOptions = {}) {
	const {
		getName = (x: string) => x
	} = opts;

	const { map: scope_map } = perisopic.analyze(node);
	const deconflicted = new WeakMap();

	walk(node, {
		enter(node: any, parent: any) {
			if (is_reference(node, parent)) {

			}
		}
	});

	const generator = Object.assign({}, astring.baseGenerator, {
		AwaitExpression(this: any, node: any, state: any) {
			state.write('await ');
			const { argument } = node;
			this[argument.type](argument, state);
		},

		FunctionExpression(this: any, node: any, state: any) {
			const params = [].concat(...node.params.map((param: any) => {
				if (param.type === 'SequenceExpression') {
					return param.expressions;
				}

				return param;
			}));

			return astring.baseGenerator.FunctionExpression.call(this, { ...node, params }, state);
		},

		Identifier(this: any, node: any, state: any) {
			if (node.name[0] === '@') {
				node = { ...node, name: getName(node.name.slice(1)) }
			}

			if (node.name[0] === '#') {
				const scope = scope_map.get(node);
				const owner = scope.find_owner(node.name);

				if (!deconflicted.has(owner)) {
					deconflicted.set(owner, new Map());
				}

				const deconflict_map = deconflicted.get(owner);

				if (!deconflict_map.has(node.name)) {
					deconflict_map.set(node.name, deconflict(node.name.slice(1), owner.references));
				}

				const name = deconflict_map.get(node.name);
				node = { ...node, name };
			}

			return astring.baseGenerator.Identifier.call(this, node, state);
		}
	});

	const map = new SourceMap.SourceMapGenerator({
		file: opts.file
	});

	const code = astring.generate(node as any, {
		indent: '\t',
		generator
	});

	return {
		code,
		map
	};
}