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
		"zoomfactor":"Zoom",
		"loadvorlage":"Vorlage laden",
		"opacity":"Sichtbarkeit",
		"showgrid":"Gitter zeigen",
		"showdots":"Punkte zeigen",
		"showdraw":"Zeichnung zeichnen",
		"optimizestrokes":"Linien optimieren",
		"frageReverseLines":"Darf die Linienrichtung umgekehrt werden?",

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

		"speichern":"Speicheroptionen",
		"exportgcode":"speichern",
		
		"notcorrectfile":"Diese Datei kann ich nicht lesen :-/",
		"notpfade":"Keine verwertbare Pfade oder Polylines enthalten :-/",
		"scaletoblatt":"Auf Fläche scalieren?",

		"controlandsave":"Einstellungen & speichern",
		"einstllungengcode":"Maschineneinstellungen",

		"titel_einstellungen":"Maschineneinstellungen",
		"buttclose":"schließen",
		"deletevorlage":"Vorlage löschen",
		"gcodeprestart":	"gcode am Anfang der Datei", 
		"gcodestart":		"gcode wenn Programm startet", 
		"gcodeLinienbegin": "gcode wenn Line startet",
		"gcodeLinienende":	"gcode wenn Line endet",
		"gcodeende": 		"gcode wenn Programm endet",
		"movespeed":"Geschwindigkeit Werkzeug bewegen",
		"drawspeed":"Geschwindigkeit Werkzeug zeichnet Linie",
		"vorlagenname":"Vorlagenname",
		"addtovorlage":"Vorlage merken",
		
		"gcodeplatzhaltertext":"Mit Platzhalter können Datenabhängige Daten eingefügt werden:<br><b>$sysinfo</b> allgemeine Infos eingefügen<br><b>$movetoYmax</b> Code der das Werkzeug nach Beendigung der Grafik an die maximale benutzte Y-Position fährt<br><b>$moveto00</b> Code der das Werkzeug nach Beendigung der Grafik an Position 0/0 fährt<br>alles nach <b>;</b> sind Kommentare"
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
		"zoomfactor":"zoom",
		"loadvorlage":"Load template",
		"opacity":"transparency",
		"showgrid":"Show grid",
		"showdots":"Show points",
		"showdraw":"Show drawing",
		"optimizestrokes":"optimize strokes",
		"frageReverseLines":"Can the line direction be reversed?",
		 
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

		"speichern":"saving options",
		"exportgcode":"save",
		
		"notcorrectfile":"I can not read this file :-/",
		"notpfade":"No usable paths or polylines :-/",
		"scaletoblatt":"Scale to paper?",
		
		"controlandsave":"settings and save",
		"einstllungengcode":"machine settings",
		
		"titel_einstellungen":"machine settings",
		"buttclose":"close",
		"deletevorlage":"Delete template",
		"gcodeprestart":	"gcode at the beginning of the file", 
		"gcodestart":		"gcode when program starts", 
		"gcodeLinienbegin": "gcode when line starts",
		"gcodeLinienende":	"gcode when Line ends",
		"gcodeende": 		"gcode when program ends",
		"movespeed":"movespeed",
		"drawspeed":"drawspeed",
		"vorlagenname":"template name",
		"addtovorlage":"Remember template",
		
		"gcodeplatzhaltertext":"With placeholder data-dependent data can be inserted: <br> <b> $ sysinfo </ b> general information inserted <br> <b> $ movetoYmax </ b> Code that moves the tool to the maximum used Y-position<br> everything after <b>; </ b> are comments"
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

