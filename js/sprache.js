"use strict";

var spracheaktiv="DE";
var sprachen=[
	{"language":"DE",
	 "description":"deutsch",
	 "words":{//"id":"wort in Sprache"
		 "loading":"lade daten...",
		 "Strichstaerke":"Strichstärke",
		 "Striche":"Striche",
		 "Zeichenflaeche":"Zeichenfläche",
		 "breite":"Breite",
		 "hoehe":"Höhe",
		 "loadvorlage":"Vorlage laden",
		 "opacity":"Sichtbarkeit",
		 "showdots":"Punkte zeigen",
		 "showdraw":"Zeichnung zeichnen",
		 "moveto":"verschieben nach",
		 "moveleft":"links",
		 "moveright":"rechts",
		 "movetop":"oben",
		 "movedown":"unten",
		 "scale":"Scalieren",
		 "scalemore":"größer",
		 "scaleless":"kleiner",
		 
		 "delvorlage":"Vorlage löschen",
		 "clearZeichnung":"Zeichnung löschen",
		 "dellaststroke":"letzten Strich löschen (strg+z)",
		 "loadgcode":"Grafik laden",
		 "exportgcode":"als gcode speichern",
		 "notcorrectfile":"Diese Datei kann ich nicht lesen :-/"
		}
	},
	{"language":"EN",
	 "description":"english",
	 "words":{
		  "loading":"loading...",
		 "Strichstaerke":"Line width",
		 "Striche":"lines",
		 "Zeichenflaeche":"Canvas size",
		 "breite":"width",
		 "hoehe":"height",
		 "loadvorlage":"Load template",
		 "opacity":"transparency",
		 "showdots":"Show points",
		 "showdraw":"Show drawing",
		 "moveto":"move to the ",
		 "moveleft":"left",
		 "moveright":"right",
		 "movetop":"top",
		 "movedown":"down",
		 "scale":"scale",
		 "scalemore":"greater",
		 "scaleless":"smaller",
		 
		 "delvorlage":"delete template",
		 "clearZeichnung":"Delete the drawing",
		 "dellaststroke":"Delete the last stroke (strg+z)",
		 "loadgcode":"load grafik",
		 "exportgcode":"save gcode",
		 "notcorrectfile":"I can not read this file :-/"
	 }
	}
];


var getWort=function(s){
	var i,spra;
	for(i=0;i<sprachen.length;i++){
		spra=sprachen[i];
		if(spra.language==spracheaktiv){
			if(spra.words[s]!=undefined)
				return spra.words[s];		//gefunden Übersetzung zurückgeben
		}
	}	
	return s; //nicht gefunden, Eingabe zurückgeben
};

