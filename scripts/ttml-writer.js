/**
 * @fileoverview
 * 用于将内部歌词数组对象导出成 TTML 格式的模块
 * 但是可能会有信息会丢失
 */
import { JSDOM } from "jsdom";
import prettier from "prettier";

function msToTimestamp(timeMS) {
	if (timeMS === Infinity) {
		return "99:99.999";
	}
	timeMS = timeMS / 1000;
	const secs = timeMS % 60;
	timeMS = (timeMS - secs) / 60;
	const mins = timeMS % 60;
	const hrs = (timeMS - mins) / 60;

	const h = hrs.toString().padStart(2, "0");
	const m = mins.toString().padStart(2, "0");
	const s = secs.toFixed(3).padStart(6, "0");

	if (hrs > 0) {
		return `${h}:${m}:${s}`;
	} else {
		return `${m}:${s}`;
	}
}

export function exportTTMLText(lyric, pretty = false) {
	const params = [];

	let tmp = [];
	for (const line of lyric) {
		if (line.originalLyric.length === 0 && tmp.length > 0) {
			params.push(tmp);
			tmp = [];
		} else if (!line.isBackgroundLyric && line.originalLyric.length > 0) {
			tmp.push(line);
		}
	}

	if (tmp.length > 0) {
		params.push(tmp);
	}

	const jsdom = new JSDOM(
		`<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal"><head></head><body></body></tt>`,
		{
			contentType: "application/xml",
		},
	);
	const doc = jsdom.window.document;

	const head = doc.querySelector("head");

	const body = doc.querySelector("body");
	const hasOtherPerson = !!lyric.find((v) => v.shouldAlignRight);

	const metadata = doc.createElement("metadata");
	const mainPersonAgent = doc.createElement("ttm:agent");
	mainPersonAgent.setAttribute("type", "person");
	mainPersonAgent.setAttribute("xml:id", "v1");

	metadata.appendChild(mainPersonAgent);

	if (hasOtherPerson) {
		const otherPersonAgent = doc.createElement("ttm:agent");
		otherPersonAgent.setAttribute("type", "other");
		otherPersonAgent.setAttribute("xml:id", "v2");

		metadata.appendChild(otherPersonAgent);
	}

	head.appendChild(metadata);

	const guessDuration =
		(lyric[lyric.length - 1]?.beginTime ?? 0) +
		(lyric[lyric.length - 1]?.duration ?? 0);
	body.setAttribute("dur", msToTimestamp(guessDuration));

	for (const param of params) {
		const paramDiv = doc.createElement("div");
		const beginTime = param[0]?.beginTime ?? 0;
		const endTime =
			(param[param.length - 1]?.beginTime ?? 0) +
			(param[param.length - 1]?.duration ?? 0);

		paramDiv.setAttribute("begin", msToTimestamp(beginTime));
		paramDiv.setAttribute("end", msToTimestamp(endTime));

		let i = 0;

		for (const line of param) {
			const lineP = doc.createElement("p");
			const beginTime = line.beginTime ?? 0;
			const endTime = line.beginTime + line.duration;

			lineP.setAttribute("begin", msToTimestamp(beginTime));
			lineP.setAttribute("end", msToTimestamp(endTime));

			lineP.setAttribute("ttm:agent", line.shouldAlignRight ? "v2" : "v1");
			lineP.setAttribute("itunes:key", `L${++i}`);

			if (line.dynamicLyric && line.dynamicLyricTime !== undefined) {
				for (const word of line.dynamicLyric) {
					const span = doc.createElement("span");
					span.setAttribute("begin", msToTimestamp(word.time));
					span.setAttribute("end", msToTimestamp(word.time + word.duration));
					span.appendChild(doc.createTextNode(word.word.trim()));
					lineP.appendChild(span);
				}
			} else {
				lineP.appendChild(doc.createTextNode(line.originalLyric));
			}

			if (line.backgroundLyric) {
				const bgLine = line.backgroundLyric;
				const bgLineSpan = doc.createElement("span");

				bgLineSpan.setAttribute(
					"ttm:agent",
					bgLine.shouldAlignRight ? "v2" : "v1",
				);
				bgLineSpan.setAttribute("itunes:key", `L${++i}`);

				if (bgLine.dynamicLyric && bgLine.dynamicLyricTime !== undefined) {
					for (const word of bgLine.dynamicLyric) {
						const span = doc.createElement("span");
						span.setAttribute("begin", msToTimestamp(word.time));
						span.setAttribute("end", msToTimestamp(word.time + word.duration));
						span.appendChild(doc.createTextNode(word.word.trim()));
						bgLineSpan.appendChild(span);
					}
				} else {
					bgLineSpan.appendChild(
						doc.createTextNode(bgLine.originalLyric.trim()),
					);
				}

				if (bgLine.translatedLyric) {
					const span = doc.createElement("span");
					span.setAttribute("ttm:role", "x-translation");
					span.setAttribute("xml:lang", "zh-CN");
					span.appendChild(doc.createTextNode(bgLine.translatedLyric.trim()));
					bgLineSpan.appendChild(span);
				}

				if (bgLine.romanLyric) {
					const span = doc.createElement("span");
					span.setAttribute("ttm:role", "x-roman");
					span.appendChild(doc.createTextNode(bgLine.romanLyric.trim()));
					bgLineSpan.appendChild(span);
				}

				lineP.appendChild(bgLineSpan);
			}

			if (line.translatedLyric) {
				const span = doc.createElement("span");
				span.setAttribute("ttm:role", "x-translation");
				span.setAttribute("xml:lang", "zh-CN");
				span.appendChild(doc.createTextNode(line.translatedLyric.trim()));
				lineP.appendChild(span);
			}

			if (line.romanLyric) {
				const span = doc.createElement("span");
				span.setAttribute("ttm:role", "x-roman");
				span.appendChild(doc.createTextNode(line.romanLyric.trim()));
				lineP.appendChild(span);
			}

			paramDiv.appendChild(lineP);
		}

		body.appendChild(paramDiv);
	}

	if (pretty) {
		return prettier.format(jsdom.serialize(), { parser: "html" });
	} else {
		return jsdom.serialize();
	}
}