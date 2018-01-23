"use strict";
/*
	Grundsetting mit laden/speichern der aktuellen Fensterposition und Größe (+Setting in Programmeinstellungen)
	
	alle Maße in mm
	
	TODO: 
	-wechsel der Spache
	-farbige Linien -> gcode Select Tool? "; color:#rrggbb" M280 P0 S0  P=Servonr.
	
*/
/*
	HTML:
	<body class="main">
		<div id="myapplication">
			<div id="zeichenfeld">										
				<canvas id="canHG"/>									für Maße, sonst nicht genutzt (TODO: überflüssig?)
				<canvas id="canVorlage"/>								Vorlagebild
				<canvas id="canLines"/>									Gitter
				<canvas id="canZeichnung"/>								Zeichnung
				<div id="ladebalken"><div id="lbfill"></div></div>		Ladebalken, oberhalb
				<canvas id="canDraw"/>									aktuelle Linie die gerade gezeichnet wird
			</div>
			<div id="werkzeuge">
				<a class="ocbutt"></a>									Button um Seitenmenü ein-/auszuschalten
				<article></article>										Gruppe mit Buttons input etc.
				...
			</div>
			<div id="dialog"></div>
		</div>
	</body>
*/
/*
optionen.json
{"windowsize":{"x":537,"y":11,"width":1351,"height":935},
"gcodeoptions":{"spiegelY":false,"spiegelX":true}

,"drawoptions":{"abweichung":6,"abstandmin":0.8,"grobabweichung":80,"weitemm":2.5,"showgrid":true,"blatt":{"width":100,"height":100,"zoom":1}},
"dateiio":{"lastdateiname":"D:\\grafik\\_test_.gcode"},

"showDevTool":true}
*/

const electron = require('electron');
const {remote} = electron;
const {dialog, BrowserWindow} = remote;
const fs = require('fs');



var electron_app=function(){
	var Programmeinstellungen={//als Einstellungen gespeichert
		windowsize:{x:0,y:0,width:0,height:0},
		gcodeoptions:{
			"spiegelY":false,
			"spiegelX":true				
		},
		gcodevorlagen:[
			{	"name":"Plotter",
				"erasable":false,
				"gcodeprestart":	";$sysinfo\nG21 ; set units to millimeters\nG90 ; use absolute coordinates\n\n",//Zeilenumbruch mit "\n"
				"gcodestart":		"M400 ; Wait for current moves to finish\nM280 P0 S83 ;Servo up\nG4 P200 ;wait 200ms",
				"gcodeLinienbegin":	"M400 ; wait\nM280 P0 S0 ;servo down\nG4 P200 ;wait 200ms",
				"gcodeLinienende":	"M400 ; wait\nM280 P0 S40 ;servo up\nG4 P200 ;wait 200ms",
				"gcodeende":		"M280 P0 S83; servo up\nG4 P200;wait 200ms\n\n$movetoYmax\nM84 ;disable Motors",
				"movespeed":1500,	//max F5000
				"drawspeed":600		//max F5000
			}
			,		
			{	"name":"Laser",
				"erasable":false,
				"gcodeprestart":	";$sysinfo\nG90 ;absolute Position\nM08 ;Flood Coolant On\nG21 ; set units to millimeters\n\n",//Zeilenumbruch mit "\n"
				"gcodestart":		"",
				"gcodeLinienbegin":	"M3",
				"gcodeLinienende":	"M5",
				"gcodeende":		"M9 ; Coolant Off\n$movetoStart",
				"movespeed":600,	//max F5000
				"drawspeed":600		//max F5000
			}
		
		]
		,
		gcodeoptionsV2:{
				"gcodeprestart":		"; $sysinfo\nG21 ; set units to millimeters\nG90 ; use absolute coordinates\n",//Zeilenumbruch mit "\n"
				"gcodestart":			"M400 ; Wait for current moves to finish\nM280 P0 S83 ;Servo up\nG4 P200 ;wait 200ms",
				"gcodeLinienbegin":	"M400 ; wait\nM280 P0 S0 ;servo down\nG4 P200 ;wait 200ms",
				"gcodeLinienende":	"M400 ; wait\nM280 P0 S40 ;servo up\nG4 P200 ;wait 200ms",
				"gcodeende":			"M280 P0 S83; servo up\nG4 P200;wait 200ms\n\n$movetoYmax\nM84 ;disable Motors",
				"movespeed":600,	//max F5000
				"drawspeed":600		//max F5000
		},
		drawoptions:{
			//Line-Optimierungen
			"abweichung":6,			//°Winkel
			"abstandmin":0.8,  		//mm
			"grobabweichung":80,	//°Winkel	
			"weitemm":2.5,			//verschiebe um mm
			
			"showgrid":true,
			
			"blatt":{"width":100,"height":100,"zoom":1}
		},
		dateiio:{
			"lastdateiname":""
		}
	};
	
	var appdata={
		userdokumente:"",
		userbilder:"",
		pathData:"",
		ProgrammOrdner:"SplineWriter",
		DateinameOptionen:"optionen.json"
	}
	
	var inpElementeList=[];//Werkzeug-InputElemente
	
	var zielNode;
	var app = require('electron').remote; 
	var path = require('path');
	path.join(__dirname, 'templates');
	//console.log(__dirname,path);

	
	//--basic--
	var gE=function(id){if(id=="")return undefined; else return document.getElementById(id);}
	var cE=function(z,e,id,cn){
		var newNode=document.createElement(e);
		if(id!=undefined && id!="")newNode.id=id;
		if(cn!=undefined && cn!="")newNode.className=cn;
		if(z)z.appendChild(newNode);
		return newNode;
	}
	var istClass=function(htmlNode,Classe){
		if(htmlNode!=undefined && htmlNode.className){
			var i,aClass=htmlNode.className.split(' ');
			for(i=0;i<aClass.length;i++){
					if(aClass[i]==Classe)return true;
			}	
		}		
		return false;
	}
	var addClass=function(htmlNode,Classe){	
		var newClass;
		if(htmlNode!=undefined){
			newClass=htmlNode.className;
			if(newClass==undefined || newClass=="")newClass=Classe;
			else
			if(!istClass(htmlNode,Classe))newClass+=' '+Classe;			
			htmlNode.className=newClass;
		}			
	}

	var subClass=function(htmlNode,Classe){
		var aClass,i;
		if(htmlNode!=undefined && htmlNode.className!=undefined){
			aClass=htmlNode.className.split(" ");	
			var newClass="";
			for(i=0;i<aClass.length;i++){
				if(aClass[i]!=Classe){
					if(newClass!="")newClass+=" ";
					newClass+=aClass[i];
					}
			}
			htmlNode.className=newClass;
		}
	}
	var delClass=function(htmlNode){
		if(htmlNode!=undefined) htmlNode.className="";		
	}
	var getClasses=function(htmlNode){return htmlNode.className;}
	
	var streckenlaenge2D=function(p1,p2) {//[x,y][x,y] c²=a²+b²
		return Math.sqrt( Math.pow(p2[1]-p1[1],2)+Math.pow(p2[0]-p1[0],2));
	} 
	var getWinkel=function(p0,p1,p2 ,rkorr){//[x,y][x,y][x,y]
		//Winkel Strecke p0-p1 zu p1-p2 in Grad
		var re=0;
		var a=streckenlaenge2D(p1,p2);
		var b=streckenlaenge2D(p0,p2);
		var c=streckenlaenge2D(p0,p1);	
		
		if(a>0 && b>0 && c>0)
			re=Math.acos((a*a+c*c-b*b)/(2*a*c))* 180/Math.PI;
//console.log(Math.floor(re*100)/100);		
		//p1.x links von p2.x?
 
		 if(isNaN(re)){
			 //console.log(">>",a,b,c,p0,p1,p2);
			 re=180;//drei Punkte auf einer Geraden
		 }
		if(rkorr)if(p1[0]<p2[0])re=re*-1;
 
		return Math.floor(re*100)/100;
	}
	
	var streckenlaengePoint=function(p1,p2){
		return Math.sqrt( Math.pow(p2.y-p1.y,2)+Math.pow(p2.x-p1.x,2));
	}
	
	function getMouseP(e){
		return{
			x:document.all ? window.event.clientX : e.pageX,	//pageX
			y:document.all ? window.event.clientY : e.pageY
			};
	}
	function getPos(re,o){
		var r=o.getBoundingClientRect();
		re.x-=r.left;
		re.y-=r.top;
		return re;
	}
	function relMouse(e,o){
		return getPos(getMouseP(e),o);
	}
		
		
	//--electron--
	
	var addprobs=function(ziel,props){
		var property;
		
		for( property in props ) {
			if(typeof props[property] === "object"){
				if(ziel[property]==undefined)ziel[property]={};
				addprobs(ziel[property],props[property]);		//rekursiev, jede Eigenschaft an Objekt seperat anhängen
			}
			else
				ziel[property]=props[property];
		}
	}
	var getSettingsAtStart=function(){
		var r,optionen,
			win=remote.getCurrentWindow();
			
		if(fs.existsSync(appdata.pathData+appdata.DateinameOptionen)){
			r=fs.readFileSync(appdata.pathData+appdata.DateinameOptionen,'utf-8',"a");
			if(r!=""){
				console.log('loaded',appdata.pathData+appdata.DateinameOptionen);
				optionen=JSON.parse(r);
				if(optionen.windowsize!=undefined){
					win.setPosition(optionen.windowsize.x,optionen.windowsize.y);
					if(optionen.windowsize.width>0 && optionen.windowsize.height>0)
						win.setSize(optionen.windowsize.width,optionen.windowsize.height);
				}
				//settings
				//gespeicherte Propertys anfügen/ersetzen
				addprobs(Programmeinstellungen,optionen);
				console.log(Programmeinstellungen,optionen);
			}
		}
		else{
			console.log("keine Optionsdatei gefunden. "+appdata.pathData+appdata.DateinameOptionen);
		}
	}

	var savesettingtimer=undefined;
	var saveSettings=function(){
		if(savesettingtimer!=undefined)clearTimeout(savesettingtimer);
		savesettingtimer=setTimeout(saveSettingsNow,50);//50ms Verzug, da Mehrfachaufrufe erfolgen
	}
	
	var saveSettingsNow=function(){
		if(savesettingtimer!=undefined){
			clearTimeout(savesettingtimer);
			savesettingtimer=undefined;
		}
		//asyncron
		fs.writeFile(
				appdata.pathData+appdata.DateinameOptionen, 
				JSON.stringify(Programmeinstellungen),
				'utf-8',
				statussaving
			);
		console.log("save",Programmeinstellungen);
	}	
	var statussaving=function(err){
		if(err){
			showDevTools(true);
			console.log("saveSettings Fehler:",err);
		}
		else{
			console.log("saveSettings ok");	
		}
	}
	var isdevtool=false;
	var showDevTools=function(b){
		var win=remote.getCurrentWindow();
		if(b===true)				
			win.webContents.openDevTools();
			else
			win.webContents.closeDevTools();
		isdevtool=b;
		Programmeinstellungen.showDevTool=b;
	}
	
	
	//--basicsEvent--
	var EventResize=function(event){
		var win=remote.getCurrentWindow();
		var bereich=win.getBounds();// x: 279, y: 84, width: 1250, height: 640
		Programmeinstellungen.windowsize=bereich;
		saveSettings();
	}
	
	this.ini=function(zielid){
		//electron basisc ini
		var win=remote.getCurrentWindow();
		appdata.userdokumente=app.app.getPath('documents');// C:\Users\andreas\Documents 
		if(!fs.existsSync(appdata.userdokumente+"\\"+appdata.ProgrammOrdner)){			
			fs.mkdirSync(appdata.userdokumente+"\\"+appdata.ProgrammOrdner);		//create dir if not
		}
		appdata.pathData=appdata.userdokumente+"\\"+appdata.ProgrammOrdner+"\\";
		appdata.pathData=path.normalize(appdata.pathData);
		
		appdata.userbilder=app.app.getPath('pictures');
		
		getSettingsAtStart();
		

		win.on('move',EventResize);
		//http://electron.atom.io/docs/api/web-contents/
		window.addEventListener('resize',EventResize );
		
		//myProgramm
		zielNode=gE(zielid);
		zielNode.innerHTML="";		
		
		CreateProgramm();
		win.webContents.closeDevTools();
		if(Programmeinstellungen.showDevTool===true){
			showDevTools(true);
		}
	}
		
	//--Programm--
	var zeichenfeld;	
	var werkzeuge;
	var thedialog;
	
		
	var CreateProgramm=function(){
		//showDevTools(true);
		//zielNode.innerHTML="Hallo.";
		var node;
		zeichenfeld=new oZeichenfeld(zielNode);
		
		werkzeuge=new oWerkzeuge(zielNode);
		
		thedialog=new oDialog(zielNode);
		
		zeichenfeld.resize();
		console.log("press STRG+D for developertools.");
	}
	
	var oWerkzeuge=function(ziel){
		var openclosebutt;
		var inpStaerke;
		var inpWidth;
		var inpHeight;
		var inpZoom;
		//var inpAnzahlStriche;
		var inpShowgrid;
		var inpShowdots;
		var inpShowdrawing;
		
		//--API--
		this.get=function(sWert){
			
			Programmeinstellungen.drawoptions.blatt.width=parseInt(inpWidth.getVal());
			Programmeinstellungen.drawoptions.blatt.height= parseInt(inpHeight.getVal());
			Programmeinstellungen.drawoptions.blatt.zoom= parseFloat(inpZoom.getVal());
			Programmeinstellungen.drawoptions.showgrid=inpShowgrid.getVal();
			
			if(sWert=="width")	return parseInt(inpWidth.getVal());
			if(sWert=="height")	return parseInt(inpHeight.getVal());
			if(sWert=="zoom")	return parseFloat(inpZoom.getVal());
			if(sWert=="linewidth")	return parseFloat(inpStaerke.getVal());
			if(sWert=="showgrid")return inpShowgrid.getVal();
			if(sWert=="showdots")return inpShowdots.getVal();
			if(sWert=="showdraw")return inpShowdrawing.getVal();
		}
		this.set=function(id,wert){
			if(id=="width")	inpWidth.setVal(parseInt(wert));
			if(id=="height")inpHeight.setVal(parseInt(wert));
			//if(id=="zoom")inpHeight.setVal(parseFloat(wert));
			saveSettings();
		}
		
		//--input-actions--
		var wopenclose=function(e){
			if( istClass(zielNode,"werkzeugeoffen") )
				subClass(zielNode,"werkzeugeoffen");
			else
				addClass(zielNode,"werkzeugeoffen");
			
			if(zeichenfeld){zeichenfeld.resize()}
			
			e.preventDefault();//return false
		}
		
		var changeElemente=function(v){
			if(zeichenfeld)zeichenfeld.resize();
			saveSettings();
		}
			
		var changeExportOptionen=function(v){
			var i,ipe;
			//console.log(v,inpElementeList);
			for(i=0;i<inpElementeList.length;i++){
				ipe=inpElementeList[i];
				
				if(ipe.getName()==getWort('showgrid')){Programmeinstellungen.drawoptions.showgrid=ipe.getVal();}
			}
			//save Programmeinstellungen
			saveSettings();
			
		}
		
		//--ini--		
		var create=function(){
			//
			var div,inpbutt,gruppe,h1;
			var werkznode=cE(zielNode,"div","werkzeuge");
			
			//Werkzeuge ein/ausfahren
			openclosebutt=cE(werkznode,"a",undefined,"ocbutt");
			openclosebutt.innerHTML="";
			openclosebutt.href="#";
			openclosebutt.addEventListener('click',wopenclose);
			
		
		/*
			(gruppenname +-)		
			|optionen |
			...
		
			<article>
				<h1>gruppenname</h1>+klickevent
				<div><label /><input /><span /><div> //Textdavor, input(text,number,range) textdanach
				
				<div><label /><input /><label htmlfor /><div> //Switchbutton (checkbox)
				
				<div><input /><div> //Button (button)
				
			</article>
		
		*/
			
			//Info
			//inpAnzahlStriche=new inputElement(getWort('anzlinien'),'text',node);
			//inpAnzahlStriche.inaktiv(true);
			
			//div=cE(node,"div",undefined,"linetop");
			
			gruppe=cE(werkznode,"article");
			//Blatt			
			h1=cE(gruppe,"h1");
			h1.innerHTML=getWort("Zeichenflaeche")+":";
			
			inpWidth=new inputElement(getWort('breite'),'number',gruppe,getWort('mm'));
			inpWidth.setVal(Programmeinstellungen.drawoptions.blatt.width);
			inpWidth.setMinMaxStp(0,500);
			inpWidth.addEventFunc(changeElemente);
			
			inpHeight=new inputElement(getWort('hoehe'),'number',gruppe,getWort('mm'));
			inpHeight.setVal(Programmeinstellungen.drawoptions.blatt.height);
			inpHeight.setMinMaxStp(0,500);
			inpHeight.addEventFunc(changeElemente);
			
			inpZoom=new inputElement(getWort('zoomfactor'),'number',gruppe);
			inpZoom.setVal(Programmeinstellungen.drawoptions.blatt.zoom);
			inpZoom.setMinMaxStp(0.1,5,0.1);
			inpZoom.addEventFunc(changeElemente);
			
			
			//gruppe=cE(werkznode,"article");
			//import/export
			inpbutt=new inputElement(getWort('loadgcode'),'button',gruppe);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.importgcodesvg();} );
			
			
			gruppe=cE(werkznode,"article");
			
			//Helperlein
			inpbutt=new inputElement(getWort('loadvorlage'),'button',gruppe);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.loadvorlage();} );
			
			inpbutt=new inputElement(getWort('delvorlage'),'button',gruppe);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.delvorlage();} );
						
			div=cE(gruppe,"div",undefined,"block");
			inpbutt=new inputElement(getWort('opacity'),'range',div);
			inpbutt.setMinMaxStp(0,1,0.05);
			inpbutt.setVal(1);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.setVorlageTransparenz(v);} );
			
			
			gruppe=cE(werkznode,"article");
			//Stift
			inpStaerke=new inputElement(getWort('Strichstaerke'),'number',gruppe,getWort('mm'));
			inpStaerke.setVal(0.5);
			inpStaerke.setMinMaxStp(0.1,10,0.05);
			inpStaerke.addEventFunc(changeElemente);
			
			//viewoptions
			inpbutt=new inputElement(getWort('clearZeichnung'),'button',gruppe);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.clear();} );
			
			inpbutt=new inputElement(getWort('dellaststroke'),'button',gruppe);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.dellaststroke();} );
			
			inpShowgrid=new inputElement(getWort('showgrid'),'checkbox',gruppe);
			inpShowgrid.setVal(Programmeinstellungen.drawoptions.showgrid);
			inpShowgrid.addEventFunc(changeElemente);
			
			inpShowdots=new inputElement(getWort('showdots'),'checkbox',gruppe);
			inpShowdots.addEventFunc(changeElemente);
			
			inpShowdrawing=new inputElement(getWort('showdraw'),'checkbox',gruppe);
			inpShowdrawing.addEventFunc(changeElemente);
			
			//Optimierungen
			inpbutt=new inputElement(getWort('optimizestrokes'),'button',gruppe);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.optimizestrokes();} );
			
			
			gruppe=cE(werkznode,"article");
			//Zeichnung actions: 
			h1=cE(gruppe,"h1");
			h1.innerHTML=getWort("moveto")+":";
			
			
			inpbutt=new inputElement(getWort('moveleft'),'button',gruppe);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.moveto("L");} );
			inpbutt.setClass("minibutt moveL");
			
			inpbutt=new inputElement(getWort('moveright'),'button',gruppe);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.moveto("R");} );
			inpbutt.setClass("minibutt moveR");
			
			inpbutt=new inputElement(getWort('movetop'),'button',gruppe);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.moveto("T");} );
			inpbutt.setClass("minibutt moveT");
			
			inpbutt=new inputElement(getWort('movedown'),'button',gruppe);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.moveto("D");} );
			inpbutt.setClass("minibutt moveD");
			
			
			inpbutt=new inputElement(getWort('scaleless'),'button',gruppe);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.scale("-");} );
			inpbutt.setClass("minibutt scaleM");
			
			inpbutt=new inputElement(getWort('scalemore'),'button',gruppe);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.scale("+");} );
			inpbutt.setClass("minibutt scaleP");
			
			//TODO: rotate +-90°
			
			
			
			gruppe=cE(werkznode,"article");
			h1=cE(gruppe,"h1");
			h1.innerHTML=getWort("controlandsave")+":";
			
			//gcode Einstellungen
			inpbutt=new inputElement(getWort('einstllungengcode'),'button',gruppe);
			inpbutt.addEventFunc( function(v){thedialog.showDialog('einstellungen');} );
						
			//Grafik Speichern als gcode oder svg
			inpbutt=new inputElement(getWort('exportgcode'),'button',gruppe);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.exportgcode();} );
			
			addClass(zielNode,"werkzeugeoffen");
			refreshInputElemente();
		}
		
		create();
	}
	
	var oZeichenfeld=function(ziel){
		var _this=this;
		var zeichnung=[];
		var strichepunkte=[];
		var basisnode;
		var canvasHG;
		var canvasVorlage;
		var canvasLines;
		var canvasZeichnung;
		var ladebalken,ladebalkenf;
		var canvasDraw;
		var rand=10;//px
		var apptitel="";
		var korr=0.5;
		var stiftsize=1;//mm
		var zommfactor=1;
		
		var farbeStift="#000000";
		var farbeZeichnung="#222222";
		var farbepunkteStart="#ff0000";
		var farbepunkte="#ffd65b";
		
		var mausXY={x:0,y:0,px:0,py:0};//cm|pixel
		var mausstat={
			"isdown":false,
			"lastpos":{x:0,y:0,px:0,py:0},
			"isstart":false
		}
		
		//--API--
		this.getLineCount=function(){return zeichnung.length;}
		
		this.resize=function(){
			resizeZF();
		}
				
		this.clear=function(){
			//Zeichnung löschen
			zeichnung=[];
			resizeZF();
		}
		
		this.dellaststroke=function(){
			var i,line,tempgrafik=[];
			if(zeichnung.length==0)return;
			for(i=0;i<zeichnung.length-1;i++){
				tempgrafik.push(zeichnung[i]);
			}
			zeichnung=tempgrafik;
			resizeZF();
		}
		
		this.loadvorlage=function(){
			dialog.showOpenDialog(
					{
						defaultPath :appdata.userbilder,//+"/"+daten.filename,
						properties: ['openFile'],
						filters: [
							{name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif']},
							{name: 'All Files', extensions: ['*']}
						  ]
					},
					function (filesNames) {
						   if (filesNames === undefined){
						   }
						   else{
							  console.log(filesNames);// An array
							  if(filesNames.length>0)
								loadVorlagenbild(filesNames[0]);
						   }
					}
				); 
		}
		this.delvorlage=function(){
			loadVorlagenbild("");
		}
		
		this.exportgcode=function(){
			//save ...
			var inptDateiname=function(fileName){
				var typ="gcode";
				if(fileName.indexOf('.svg')>-1)typ="svg";
				
				if(typ=="svg"){
					fs.writeFileSync(fileName, getDataAsSVG(),'utf8');
					alert("Datei "+fileName+" gespeichert.");					
				}
				else//gcode
				{
					 if(fileName.indexOf('.gcode')<0)fileName+='.gcode';
					 fs.writeFileSync(fileName, getDataAsGcode(),'utf8');
					 alert("Datei "+fileName+" gespeichert.");
				}
				
				   
				Programmeinstellungen.dateiio.lastdateiname=fileName;
				saveSettings();
			}			
			getExportDateiname(inptDateiname);
		}
			
		var parsegcodeopt=function(s,data){
			if(s.indexOf("$sysinfo")>-1){
				var datum=new Date();
				s=s.split("$sysinfo").join("; "+datum);
			}
			if(s.indexOf("$movetoYmax")>-1){
				if(data && data["$movetoYmax"]!=undefined)
					s=s.split("$movetoYmax").join(data["$movetoYmax"]);
				else
					s=s.split("$movetoYmax").join("");
			}			
			if(s.indexOf("$movetoStart")>-1){
				if(data && data["$movetoStart"]!=undefined)
					s=s.split("$movetoStart").join(data["$movetoStart"]);
				else
					s=s.split("$movetoStart").join("");
			}
			s+="\n";
			return s;
		}
			
		var getDataAsGcode=function(){	
			var lz,pz,p,linie,xx,yy;
			var daten="; SplineWriter\n";
			
			/*
			daten+="G21 ; set units to millimeters"+"\n";
			daten+="G90 ; use absolute coordinates"+"\n";
			daten+="\n";
			*/
			daten+=parsegcodeopt(Programmeinstellungen.gcodeoptionsV2.gcodeprestart); 
			
			
			var movespeed=Programmeinstellungen.gcodeoptionsV2.movespeed;
			var drawspeed=Programmeinstellungen.gcodeoptionsV2.drawspeed;
			
			var islaser=Programmeinstellungen.gcodeoptionsV2.gcodeLinienbegin.indexOf('M3')>-1;
			
			var yMul=1;
			var xMul=1;
			var yVersatz=0;//mm
			var xVersatz=0;//mm
			var maxXX=0;
			var maxYY=0;
			
			var maxX=0;//mm
			var maxY=0;//mm
			for(lz=0;lz<zeichnung.length;lz++){
				linie=zeichnung[lz];
				for(pz=0;pz<linie.length;pz++){
						p=linie[pz];
						if(p.x>maxX)maxX=p.x;
						if(p.y>maxY)maxY=p.y;
				}
			}
			if(Programmeinstellungen.gcodeoptions.spiegelY){
				yMul=-1;
				//yVersatz=maxY*10;
				yVersatz=werkzeuge.get("height");
			}
			if(Programmeinstellungen.gcodeoptions.spiegelX){
				xMul=-1;
				//xVersatz=maxX*10;
				xVersatz=werkzeuge.get("width");
			}
			
			
			
			daten+=parsegcodeopt(Programmeinstellungen.gcodeoptionsV2.gcodestart);
			
			
			
			for(lz=0;lz<zeichnung.length;lz++){
				linie=zeichnung[lz];
				for(pz=0;pz<linie.length;pz++){
					p=linie[pz];
					
					xx=rundeauf(p.x*xMul+xVersatz,3);
					yy=rundeauf(p.y*yMul+yVersatz,3);
					if(xx>maxXX)maxXX=xx;
					if(yy>maxYY)maxYY=yy;
					
					
					if(pz==0){
						//moveTo
						daten+= "G1 X"+xx+" Y"+yy+" F"+movespeed;
						//if(islaser)daten+=" S0";//grbl = Frequenz
						daten+="\n";
						
						//Servo down/Laser an
						daten+=parsegcodeopt(Programmeinstellungen.gcodeoptionsV2.gcodeLinienbegin);
					}
					else{
						if(pz==1)
								daten+="G1 X"+xx+" Y"+yy+" F"+drawspeed;
							else
								daten+="G1 X"+xx+" Y"+yy;
						
						//if(islaser)daten+=" S1000";//grbl = Frequenz
						daten+="\n";
					}
				}
				if(linie.length>0){
					//Servo up; Laser Off
					daten+=parsegcodeopt(Programmeinstellungen.gcodeoptionsV2.gcodeLinienende);
				}
			}
			
			daten+=parsegcodeopt(Programmeinstellungen.gcodeoptionsV2.gcodeende,
							{
							 '$movetoYmax'	:"G1 X0 Y"+maxYY+" F"+movespeed,
							 '$movetoStart'	:"G1 X0 Y0 F"+movespeed
							}
							);
							
			daten+="\n";			
			daten+=";Projektpage: https://github.com/polygontwist/splinewriter";			
			return daten;			
		}
		
		var getDataAsSVG=function(){
			var maxX=0,maxY=0,lz,linie,p,pz;
			var yVersatz=0;//mm
			var xVersatz=0;//mm
			
			var multiplikator_mm_to_px=64/22; //22->64
			
			var xMul=multiplikator_mm_to_px;
			var yMul=multiplikator_mm_to_px;
			
			var data="<g id=\"Ebene_1\">\n";
			
			//create lines
			for(lz=0;lz<zeichnung.length;lz++){
				linie=zeichnung[lz];//Line
								
				data+="<polyline fill=\"none\" stroke=\"#000000\" points=\"";
				
				for(pz=0;pz<linie.length;pz++){
						p=linie[pz];//Point
						if(p.x>maxX)maxX=p.x;
						if(p.y>maxY)maxY=p.y;
						if(pz>0)data+=" ";
						data+=rundeauf(p.x*xMul+xVersatz,3)+","+rundeauf(p.y*yMul+yVersatz,3);
				}
				
				data+="\" />\n";
			}
			data+="</g>\n";
			
			//create header
			var headdata="<?xml version=\"1.0\" encoding=\"utf-8\"?>\n";
			headdata+="<!-- Generator: splinewriter -->\n";
			headdata+="<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\">\n";
			headdata+="<svg version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\" width=\"";
			headdata+=(maxX*xMul)+"px\" height=\"";
			headdata+=(maxY*yMul)+"px\" viewBox=\"0 0 ";
			headdata+=(maxX*xMul)+" ";
			headdata+=(maxY*yMul)+"\" enable-background=\"new 0 0 ";
			headdata+=(maxX*xMul)+" ";
			headdata+=(maxY*yMul)+"\" xml:space=\"preserve\">\n";
						
			
			data+="\n</svg>";			
			return headdata+data;
		}
		
		this.importgcodesvg=function(){
				var dn=Programmeinstellungen.dateiio.lastdateiname;
				if(dn=="")dn=appdata.userdokumente;

				
				dialog.showOpenDialog(
					{
						defaultPath :dn,//+"/"+daten.filename,
						properties: ['openFile'],
						filters: [
							{name: 'gcode,svg', extensions: ['gcode','svg']},
							{name: 'All Files', extensions: ['*']}
						  ]
					},
					function (filesNames) {
						   if (filesNames === undefined){
						   }
						   else{
							 // console.log(filesNames);// An array
							  if(filesNames[0].length>4){
									Programmeinstellungen.dateiio.lastdateiname=filesNames[0];
								  
									if(filesNames[0].indexOf('.gcode')>-1)
										loadGCode(filesNames[0]);
									else
									if(filesNames[0].indexOf('.svg')>-1)
										loadSVG(filesNames[0]);
									else
										alert(getWort('notcorrectfile'));
								}
						   }
					}
				); 			
		}
		
		this.moveto=function(sRichtung){//L,R,T,D
			var i,line,pz,p;
			var stepx=0;
			var stepy=0;
			var weitemm=Programmeinstellungen.drawoptions.weitemm;//mm
			if(sRichtung=="L")stepx=-1;
			if(sRichtung=="R")stepx=1;
			if(sRichtung=="T")stepy=-1;
			if(sRichtung=="D")stepy=1;
			
			for(i=0;i<zeichnung.length;i++){
				line=zeichnung[i];
				for(pz=0;pz<line.length;pz++){
					p=line[pz];
					p.x+=stepx*weitemm;
					p.y+=stepy*weitemm;
				}
			}
			resizeZF();
		}
		
		this.scale=function(pm){//"+","-"
			var i,line,pz,p;
			var stepx=0;
			var stepy=0;
			var scalefactor=1;
			
			if(pm=="+")scalefactor=1/90*100;//110%
			if(pm=="-")scalefactor=0.9;//90%
			
			for(i=0;i<zeichnung.length;i++){
				line=zeichnung[i];
				for(pz=0;pz<line.length;pz++){
					p=line[pz];
					p.x=p.x*scalefactor;
					p.y=p.y*scalefactor;
				}
			}
			resizeZF();
		}
		
		
		this.setVorlageTransparenz=function(v){
			canvasVorlage.style.opacity=v;
		}
		
		this.hatVorlage=function(){
			return canvasVorlage.hatVorlage;
		}
		
		this.optimizestrokes=function(){
			//Linien so sortieren das leerfahren sehr kurz sind
			
			//zeichnung[] ganze Zeichnung (array of Linie)
			//strichepunkte[] aktuelle Linie
			var iline,ipoint,linie;
			
			if(zeichnung.length<3)return;
			
			
			var sortlineEA=function(){
				var i,t, linieA,linieB,pA,pB,pBe ,idA,idB,isadd, entfernung, id,
					templine,
					nexline={line:undefined,entfernung:undefined};
				var zeichnung_neu=[];
				
				var ignoreRichtung=false;
				
				if(!confirm(getWort("frageReverseLines"))){
					ignoreRichtung=true;
				}
				
				linieA=zeichnung[0];
				pA=linieA[linieA.length-1];
				linieA[0].isadd=true;
				zeichnung_neu.push(linieA);
				
				
				for(i=0;i<zeichnung.length;i++){//alle Linien durchgehen
					nexline={line:undefined,entfernung:undefined,reverse:false};
					
					for(t=0;t<zeichnung.length;t++){//mit allen vergleichen
						linieB=zeichnung[t];
						pB=linieB[0];//erster Punkt
						pBe=linieB[linieB.length-1];//letzter Punkt
						isadd=linieB[0].isadd;
						if(!isadd){
							entfernung=streckenlaengePoint(pA,pB);
							
							if(nexline.entfernung==undefined){
								nexline.entfernung=entfernung;
								nexline.line=linieB;
								nexline.reverse=false;
							}
							else{
								if(entfernung<nexline.entfernung){
									nexline.entfernung=entfernung;
									nexline.line=linieB;
									nexline.reverse=false;
								}
								
								if(ignoreRichtung){//auf Endpunkt testen
									entfernung=streckenlaengePoint(pA,pBe);
									if(entfernung<nexline.entfernung){
										nexline.entfernung=entfernung;
										nexline.line=linieB;
										nexline.reverse=true;
									}
								}
							}
							
						}
					}
					
					if(nexline.line!=undefined){
						//Linie hinzufügen
						linieB=nexline.line;
						id=linieB[0].id;
						linieB[0].isadd=true;
						if(nexline.reverse){
							templine=[];
							for(t=0;t<linieB.length;t++){
								templine.push(linieB[linieB.length-1-t]);
							}
							linieB=templine;
						}
						linieB[0].id=id;
						linieB[0].isadd=true;		//auf übernommen setzen
						zeichnung_neu.push(linieB);
						
						//hinzugefügte Linie als neuen Ausgangspunkt setzen
						linieA=linieB;
						pA=linieA[linieA.length-1];
					}
					
				}
				//console.log('sortlineEA',zeichnung.length,zeichnung_neu.length);
				zeichnung=zeichnung_neu;
			}
			
			for(iline=0;iline<zeichnung.length;iline++){
				linie=zeichnung[iline];//of points
				if(linie.length>0){
					linie[0].id="L"+iline;//ersten Punkt mit ID versehen
					linie[0].isadd=false; //für sortlineEA
				}
			}
			
			//nimm eine Linie und gucke welche andere am nächsten vom Endpunkt ist
			sortlineEA();
			
			resizeZF();//zeichnung neu auf Blatt malen
		}
		
		//--func--
		var setLadebalken=function(v){
			if(v==-1){
				addClass(ladebalken,"off");
				v=0;
				}
			else
				subClass(ladebalken,"off");
			
			ladebalkenf.style.width=v+"%";
		}
		
		
		//--maus/Tastatur--		
		//bei wacom leider anfangsphase ~ 5-8px als strich...
		var laststiftsize=1;
		var mausmove=function(e){
			var xy=relMouse(e,canvasDraw);
		
			var b=werkzeuge.get("width");//mm
			var cb=canvasHG.width;
			
			// /2->weniger jitter?
			//var x=b/cb*Math.floor(xy.x/1)*1;//px->mm
			//var y=b/cb*Math.floor(xy.y/1)*1;
			
			var x=Math.floor((b/cb*xy.x)*100)/100//px->mm  Genauigkeit: zwei Stellen hintern Komma
			var y=Math.floor((b/cb*xy.y)*100)/100;
			
			
			mausXY={x:x,y:y ,px:xy.x,py:xy.y};
			
			var s=apptitel+" ("+Math.floor(x*100)/100+"mm,"		// /100-> 0.01mm
							+Math.floor(y*100)/100+"mm) ";
			if(zeichnung.length>0)s+=""+zeichnung.length+" "+getWort("Striche");
			//if(mausstat.isdown)s+=" *";
			document.title=s;
			var lw=laststiftsize;
			
			if(mausstat.isdown){
				//zeichnen
				
				var cc=canvasDraw.getContext('2d');
				cc.strokeStyle=farbeStift;
				if(mausstat.isstart){
					lw=setStiftsizetopixel(cc);
					laststiftsize=lw;
					mausstat.isstart=false;
				}
				cc.beginPath();
				cc.moveTo(mausstat.lastpos.px, mausstat.lastpos.py);
				cc.lineTo(mausXY.px, mausXY.py);
				cc.stroke();
				
				//point
				if(werkzeuge.get("showdots")){
					var siz=lw*1;
					cc.fillStyle=farbepunkteStart;
					if(strichepunkte.length>0)
						cc.fillStyle=farbepunkte;
					cc.fillRect(mausXY.px+0.5-siz*0.5,mausXY.py+0.5-siz*0.5,siz,siz);
				}
				
				if(strichepunkte.length==0)
					strichepunkte.push(mausstat.lastpos);
				strichepunkte.push(mausXY);
			}
			
			mausstat.lastpos={x:x,y:y, px:xy.x,py:xy.y};
			
			e.preventDefault(); 
		}
		
		var mausdown=function(e){
			var cc=canvasDraw.getContext('2d');
			cc.clearRect(0, 0, canvasDraw.width, canvasDraw.height);
			strichepunkte=[];
			mausstat.isdown=true;
			mausstat.isstart=true;
			mausmove(e);
			
			e.preventDefault(); 
		}
		var mausup=function(e){
			if(mausstat.isdown)createLinie();
			mausstat.isdown=false;
			mausstat.isstart=false;
		}
		var mausout=function(e){
			if(mausstat.isdown)createLinie();
			mausstat.isdown=false;
		}
		
		var keydown=function(e){
			
			if(e.keyCode==90 && e.ctrlKey){//strg+z
				_this.dellaststroke();
				e.preventDefault(); 
			}
			else
			if(e.keyCode==68 && e.ctrlKey){//strg+d
				showDevTools(!isdevtool);
				e.preventDefault(); 
			}
			else{
				console.log(e);
			}
			/*if(e.keyCode==32 && !mausstat.isdown){
				
				var cc=canvasDraw.getContext('2d');
				cc.clearRect(0, 0, canvasDraw.width, canvasDraw.height);
				strichepunkte=[];
				
				mausstat.isdown=true; 
			}*/
			
		}
		var keyup=function(e){
			/*if(e.keyCode==32){
				if(mausstat.isdown)createLinie();
				mausstat.isdown=false;
				}*/
			//e.preventDefault(); 
		}
		
		var resizeZF=function(e){
			if(werkzeuge!=undefined){				
				var b=werkzeuge.get("width");//mm
				var h=werkzeuge.get("height");//mm
				
				zommfactor=werkzeuge.get("zoom");
				if(isNaN(zommfactor))zommfactor=1;
				
				var bw=basisnode.offsetWidth -rand*2;
				var bh=basisnode.offsetHeight-rand*2;
				var canb=bw;
				var canh=bh;
				
				if(bw/b<bh/h){
					//breite=bw, höhe berechnen
					canh=canb/b*h;
					
				}else{
					//höhe=bh,breite berechen
					canb=canh/h*b;
				}
				canb=canb*zommfactor;
				canh=canh*zommfactor;
				
				canvasHG.width=canb;
				canvasHG.height=canh;
				
				canvasVorlage.width=canb;
				canvasVorlage.height=canh;
				
				canvasLines.width=canb;
				canvasLines.height=canh;
				
				if(werkzeuge.get("showgrid")){
					canvasLines.style.display="block";
				}else{
					canvasLines.style.display="none";
				}
				
				
				canvasZeichnung.width=canb;
				canvasZeichnung.height=canh;
				
				canvasDraw.width=canb;
				canvasDraw.height=canh;
				
				showHGMuster();
				showZeichnung();
			}			
		
			refreshInputElemente();
		}
		
		
		//--draw--
		var showHGMuster=function(){//Raster 1cm
			var cc=canvasLines.getContext('2d');
			cc.clearRect(0, 0, canvasLines.width, canvasLines.height);
			var x,y;
			
			var b=werkzeuge.get("width");//mm
			var stepp=canvasLines.width/b*10;//je 1cm
			
			cc.strokeStyle="#badae9";
			
			for(x=0;x<canvasLines.width;x+=stepp){
				cc.beginPath();
				cc.moveTo(Math.floor(x)+korr,0);
				cc.lineTo(Math.floor(x)+korr,canvasLines.height);
				cc.stroke();
			}
			
			for(y=0;y<canvasLines.height;y+=stepp){
				cc.beginPath();
				cc.moveTo(0,Math.floor(y)+korr);
				cc.lineTo(canvasLines.width,Math.floor(y)+korr);
				cc.stroke();
			}
			
			werkzeuge.set("AnzahlStriche",zeichnung.length);
			
		}
		
				
		var setStiftsizetopixel=function(cc){
			//stiftsize=mm
			stiftsize=werkzeuge.get("linewidth");//mm
			
			var b=werkzeuge.get("width");//mm
			var stepp=canvasHG.width/b;//pixel je 1mm
			
			//console.log("stift",stepp*stiftsize,stepp,stiftsize);
			
			cc.lineWidth=stepp*stiftsize;
			cc.lineCap="round";
			cc.lineJoin="round";
			return stepp*stiftsize;
		}
	
		var vektorwinkel=function(p1,p2){
			
			var minx=Math.min(p1.x,p2.x);
			var miny=Math.min(p1.y,p2.y);
			var pp1={x:p1.x-minx,y:p1.y-miny};//auf 0/0 verschieben
			var pp2={x:p2.x-minx,y:p2.y-miny};
			
			var pp0={x:0,y:-5};
			
			/*
			var q=(pp2.y-pp1.y);
			if(q==0){
				q=1;
				//console.log((p2.x-p1.x),(p2.y-p1.y),"V",(p2.x-p1.x)/q,"*");
			}
			//else console.log((p2.x-p1.x),(p2.y-p1.y),"V",(p2.x-p1.x)/q);
			var vek=(pp2.x-pp1.x)/q;*/
			
			//Winkel Strecke p0-p1 zu p1-p2 in Grad
			var winkel=getWinkel([pp0.x,pp0.y],[pp1.x,pp1.y],[pp2.x,pp2.y],true);
			
			return winkel;
		}
		
		var Strichoptimieren=function(punkteliste){//auf x/y optimieren (übernahme wenn x/y passig)
			var i,p,pl,re=[],tmp=[],tmp2=[],abst,v,vDiffabs,lastv,pwl,winkel,p2;	
			
			if(punkteliste.length<2)return punkteliste;
			
			var abweichung=Programmeinstellungen.drawoptions.abweichung;//°Winkel
			var abstandmin=Programmeinstellungen.drawoptions.abstandmin;  //mm px?
			var grobabweichung=Programmeinstellungen.drawoptions.grobabweichung;
						
			//mindestabstand + winkel
			/**/
			tmp.push(punkteliste[0]);//ersten
			pl=punkteliste[0];
			lastv=0;
			for(i=1;i<punkteliste.length-1;i++){
				p=punkteliste[i];
				abst=streckenlaenge2D([pl.x,pl.y],[p.x,p.y]);//mm			
//if(isNaN(abst)){console.log("##",punkteliste);}				
				pwl=punkteliste[i-1];//Punkt davor
				//Punkte Winkel
				p2=punkteliste[i+1]; //Punkt danach
				v=getWinkel([pl.x,pl.y],[p.x,p.y],[p2.x,p2.y],true);
				vDiffabs=Math.abs(v-lastv);
				//console.log(abst,v,Math.abs(v-lastv));
				
				
				if(	(abst>abstandmin && vDiffabs>0.1) ||  
					(vDiffabs>80 && vDiffabs<300)	
					){ 
					
					//<300 wegen +-180Flip			
					
					tmp.push(p);
					pl=punkteliste[i];
					
					/*if((vDiffabs>80 && vDiffabs<300))
					console.log(v,	Math.floor(	(v-lastv)*100)/100,	
								Math.floor(	vDiffabs*100)/100,"+W");
					else					
					console.log(v,	Math.floor(	(v-lastv)*100)/100,	
								Math.floor(vDiffabs*100)/100,"+L");
					*/			
								
								
								
				}else{
					/*console.log(v,	Math.floor(	(v-lastv)*100)/100,
								Math.floor(	Math.abs(v-lastv)*100)/100);
					*/
				}
				lastv=v;
			}
			tmp.push(punkteliste[punkteliste.length-1]);//letzten
			
		//tmp=	punkteliste;
			//jitter entfernen (1x1 Pixelversatz)
			//var b=werkzeuge.get("width");//mm
			//var cb=canvasHG.width;
			
			/*tmp=[];
			for(i=0;i<punkteliste.length-1;i++){
				p=punkteliste[i];
				p.px=Math.floor(p.px/2)*2;//px
				p.py=Math.floor(p.py/2)*2;
				
				//p.x=b/cb*p.x;//mm
				//p.y=b/cb*p.y;
				
				
				
				tmp.push(p);
			}*/
			
			//tmp=punkteliste;
			/*re=tmp;*/
			/*
			//mindestabstand
			tmp.push(punkteliste[0]);//ersten
			pl=punkteliste[0];
			for(i=1;i<punkteliste.length-1;i++){
				p=punkteliste[i];
				abst=streckenlaenge2D([pl.x,pl.y],[p.x,p.y]);//cm				
				if(abst>abstandmin){//console.log(abst);
					tmp.push(p);
					pl=punkteliste[i];
				}else{
					//console.log(abst,"-");
				}
			}
			tmp.push(punkteliste[punkteliste.length-1]);//letzten
			*/
	//tmp=punkteliste;
			
			//Vektorwinkel	- gringt leider mehr Fehler als Nutzen
			/*re.push(tmp[0]);//den ersten mitnehmen
			lastv=0;
			for(i=1;i<tmp.length-1;i++){
				pl=tmp[i-1];
				p=tmp[i];
				
				v=vektorwinkel(pl,p);//console.log(v);
							
				if(Math.abs(v-lastv)>abweichung){
					re.push(p);
					//console.log(Math.abs(v-lastv),v);
					lastv=v;
				}
				//elseconsole.log(Math.abs(v-lastv),v,'-');
				
			}
			re.push(tmp[tmp.length-1]);//den letzten mitnehmen
			*/
			re=tmp;
			
			//Länge ermitteln
			abst=0;
			for(i=1;i<re.length;i++){
				pl=re[i-1];
				p=re[i];				
				abst+=streckenlaenge2D([pl.x,pl.y],[p.x,p.y]);
				
			}
			
			//console.log(re[0]);
			/*
			if(punkteliste.length>2 && punkteliste.length>re.length)
			console.log("Optimiert von",punkteliste.length,
						'>',tmp.length,
						"zu",re.length,"Länge:",abst);
			*/
			//if(abst==0)re=[]; //aktivieren, wenn man keine Punkte mag
				
			return re;
		}
				
		var createLinie=function(){
			//strichepunkte[] --> zeichnung + optimierung
			var cc=canvasDraw.getContext('2d');
			cc.clearRect(0, 0, canvasDraw.width, canvasDraw.height);
			
			if(strichepunkte.length<2)return;
			
			
			var AoptimierteLinie=Strichoptimieren(strichepunkte);
			if(AoptimierteLinie.length<2)return;
			
			cc=canvasZeichnung.getContext('2d');
			var i,p;
			var zline=[];
			//gezeichnete Linie in Zeichnung zeichnen
			cc.strokeStyle=farbeZeichnung;
			setStiftsizetopixel(cc);
			cc.beginPath();
			for(i=0;i<AoptimierteLinie.length;i++){
				p=AoptimierteLinie[i];
				if(i==0)
					cc.moveTo(p.px+korr,p.py+korr);
				else
					cc.lineTo(p.px+korr,p.py+korr);
				
				zline.push(AoptimierteLinie[i]);
			}
			cc.stroke();
			
			//punkte einzeichnen
			cc.fillStyle=farbepunkteStart;
			if(werkzeuge.get("showdots"))
			for(i=0;i<AoptimierteLinie.length;i++){
				p=AoptimierteLinie[i];
				if(i==1)
					cc.fillStyle=farbepunkte;
					
				cc.fillRect(p.px+korr-1,p.py+korr-1,3,3);
			}
			
			zeichnung.push(zline);
			refreshInputElemente();
		}
		
		var timer=undefined;
		var showZeichnung=function(){//transformLinie x/y zu px/py
			if(timer!=undefined)clearTimeout(timer);
			var cc=canvasZeichnung.getContext('2d');
			cc.clearRect(0, 0, canvasZeichnung.width, canvasZeichnung.height);
			var iline,ip,line,p,xx,yy;
			
			var b=werkzeuge.get("width");//mm
			var cb=canvasHG.width;//Pixel
			
			var MulmmToPix=cb/b;
			var wait=0;
			
			cc.strokeStyle=farbeZeichnung;
			setStiftsizetopixel(cc);
			
			//console.log(">",zeichnung);
			var posline=0;
			
			var zeichnen=function(){
				var ip,p,xx,yy;
				if(zeichnung.length==0)return;
				
				if(timer!=undefined)clearTimeout(timer);
				
				cc.beginPath();
				
				line=zeichnung[posline];
				
				for(ip=0;ip<line.length;ip++){
					p=line[ip];
					//cm->pixel
					xx=(p.x*MulmmToPix);
					yy=(p.y*MulmmToPix);
					
					if(ip==0)
						cc.moveTo(xx+korr,yy+korr);
					else
						cc.lineTo(xx+korr,yy+korr);
				}
				cc.stroke();
				//punkte einzeichnen
				cc.fillStyle=farbepunkteStart;
				if(werkzeuge.get("showdots"))
					for(ip=0;ip<line.length;ip++){
						p=line[ip];
						xx=(p.x*MulmmToPix);
						yy=(p.y*MulmmToPix);
						if(ip==1)cc.fillStyle=farbepunkte;
						cc.fillRect(xx+korr-1,yy+korr-1,3,3);
					}
				
				posline++;
				if(posline<zeichnung.length){
					if(wait>0)
						timer=setTimeout( function(){zeichnen()} ,wait);
					else
						zeichnen();
				}
			}
			
			if(werkzeuge.get("showdraw")){
				wait=Math.floor(1/zeichnung.length*10000*2);
				if(wait==0)wait=1;
				if(wait>20)wait=20;
			}
			zeichnen();
		}
		
		//--datei IO--
		var loadVorlagenbild=function(fileName){
			fileName=fileName.split("\\").join("/");
			canvasVorlage.style.backgroundImage="url("+fileName+")";
			canvasVorlage.hatVorlage=fileName!="";
			refreshInputElemente();
		}
		
		
		
		var rundeauf=function(val,stellen){
			var i,st=1;
			for(i=0;i<stellen;i++){
				st=st*10;
			}
			return Math.floor(val*st)/st;
		}
		var getExportDateiname=function(returnfunc){
				var dn=Programmeinstellungen.dateiio.lastdateiname;
				if(dn=="")dn=appdata.userdokumente;
			//console.log(dn,">",Programmeinstellungen.dateiio.lastdateiname);
					dialog.showSaveDialog(
						{
							defaultPath :dn,//+"/"+daten.filename,
							properties: ['openDirectory'],
							filters: [
								{name: 'gcode or svg', extensions: ['gcode','svg']},
								{name: 'gcode', extensions: ['gcode']},
								{name: 'svg', extensions: ['svg']},
								{name: 'All Files', extensions: ['*']}
							  ]
						},
						function (fileName) {
							   if (fileName === undefined){
									//console.log("You didn't save the file");
									alert("Datei nicht gespeichert.");
							   }
							   else{
								   returnfunc(fileName);
							   }
						}
					); 
		}
		
		var calcytimer;
		
		var loadGCode=function(fileName){
			if(fileName=="")return;
			Programmeinstellungen.dateiio.lastdateiname=fileName;
			setLadebalken(0);
			if(calcytimer!=undefined)clearTimeout(calcytimer);
			var i,t,linie,s,zeile,bef,value,p,sval,
				xx=0,
				yy=0,
				zz=0,
				staerke=1000,//"S123" optional
				feedrate=0,
				ee;
			
			var factorToMM=1;//Quelle=mm
			
			var hatExtruder=false;
			var isLaser=false;		//oder Motor
			var isline=true;
			
			var yMul=1,xMul=1,yVersatz=0,xVersatz=0;
			if(Programmeinstellungen.gcodeoptions.spiegelY){
				yMul=-1;
				yVersatz=werkzeuge.get("height");
			}
			if(Programmeinstellungen.gcodeoptions.spiegelX){
				xMul=-1;
				xVersatz=werkzeuge.get("width");
			}
			
			zeichnung=[];//of Lines
			linie=[];
			
			var daten=fs.readFileSync(fileName, 'utf8');
			
			var dlist=daten.split('\n');
//TODO: freie gcodes -> Erkennung anpassen ? (Linienfarbe = ServoNr ?)
			for(i=0;i<dlist.length;i++){
				zeile=dlist[i].split('\n').join('');
				zeile=zeile.split('\r').join('');
				zeile=zeile.toUpperCase().split(';')[0].split(' ').join('')+';';
				
				s=dlist[i].split(';')[0].toUpperCase().split(" ");
				//console.log(s);
				setLadebalken(100/dlist.length*i);
			
				if(s[0]=="G90" || zeile.indexOf("G90;")==0){} //absolute Position
				
				if(s[0]=="G20" || zeile.indexOf("G20;")==0)factorToMM=25.4; //inch to mm
				if(s[0]=="G21" || zeile.indexOf("G21;")==0)factorToMM=1; 	//mm
				
				if(s[0]=="M280"){//Servo
					for(t=1;t<s.length;t++){// M280 P0 S110
						bef=s[t];
						value=parseInt(bef.slice(1));
						
						if(bef.indexOf('P')==0){}//Servoport
						
						if(bef.indexOf('S')==0){//Position (0=down)
							if(value==0){//Programmeinstellungen.gcodeoptions.servoDown-ist immer 0
								linie=[];// new Line
								linie.push({x:xx,y:yy,px:0,py:0});//Ausgangspunkt
								isline=true;
							}else{//UP
								if(linie.length>0)zeichnung.push(linie);
								linie=[];
								isline=false;
								
							}
						}
					}
				}
				
				if(s[0]=="G92"){//Set Position
					if(s[1]=="E0"){
						hatExtruder=true;
						if(linie.length>0)zeichnung.push(linie);
						linie=[];
					}
				}
				
				if(s[0]=="M3" || s[0]=="M4"
						|| zeile.indexOf("M3;")==0
						|| zeile.indexOf("M4;")==0
					){//Spindle On, Clockwise|Counter-Clockwise
					isLaser=true;		
					isline=true;
					linie=[];
					linie.push({x:xx,y:yy,px:0,py:0});//add Point, aktuelle Position
				}
				if(s[0]=="M5" || zeile.indexOf("M5;")==0){//Spindle Off
					isLaser=true;
					isline=false;
					if(linie.length>1)zeichnung.push(linie);
					linie=[];
				}
				
				if(s[0]=="G1"){
					if(hatExtruder){isline=false;}
					for(t=1;t<s.length;t++){//Einzelwerte parsen
						bef=s[t];
						value=parseFloat(bef.slice(1));
						if(bef.indexOf('X')==0){xx=rundeauf(value*factorToMM*xMul+xVersatz,3);}//rundeauf drei Kommastellen
						if(bef.indexOf('Y')==0){yy=rundeauf(value*factorToMM*yMul+yVersatz,3);}
						if(bef.indexOf('Z')==0){zz=value*factorToMM;}
						
						if(bef.indexOf('S')==0){staerke=value;}//gbrl Stärke
						if(bef.indexOf('F')==0){feedrate=value;}//feedrate per minute
						
						if(bef.indexOf('E')==0){//extrude
							hatExtruder=true;
							value=bef.slice(1);
							if(value.indexOf(':')>-1)value=value.split(':')[0];
							
							if(value<=0){
								isline=false;
							}else{
								isline=true;
							}
						}
					}
					
					if(isLaser){
						if(staerke<1){
							isline=false;
						}
						else{
							isline=true;
						}
					}
					
					
					if(isline){
							linie.push({x:xx,y:yy,px:0,py:0});//add Point
						}
						else{
							if(hatExtruder){
								if(linie.length>0)zeichnung.push(linie);
								linie=[];
							}
							if(isLaser){
								if(linie.length>1)zeichnung.push(linie);
								linie=[];
								linie.push({x:xx,y:yy,px:0,py:0});//1. Point
							}
						}
				}
			}
			
			//Zeichnung checken, bei negativen Koordinaten, neu ausrichten
			var minX=0,maxX=0,minY=0,maxY=0;
			for(i=0;i<zeichnung.length;i++){//minXY holen - fals Zeichnung im negativen Bereich liegt
				for(t=0;t<zeichnung[i].length;t++){
					p=zeichnung[i][t];
					if(p.x<minX)minX=p.x;
					if(p.x>maxX)maxX=p.x;
					if(p.y<minY)minY=p.y;
					if(p.y>maxY)maxY=p.y;
				}
			}
			if(minX<0 || minY<0){
				//Zeichnung repositionieren, aus dem negativen Bereich in den positiven
				for(i=0;i<zeichnung.length;i++){
					for(t=0;t<zeichnung[i].length;t++){
						p=zeichnung[i][t];
						p.x+=(minX*-1);
						p.y+=(minY*-1);
					}
				}
			}
			minX=maxX;
			minY=maxY;
			for(i=0;i<zeichnung.length;i++){//min/max holen
				for(t=0;t<zeichnung[i].length;t++){
					p=zeichnung[i][t];
					if(p.x<minX)minX=p.x;
					if(p.x>maxX)maxX=p.x;
					if(p.y<minY)minY=p.y;
					if(p.y>maxY)maxY=p.y;
				}
			}
			
			if(maxX>werkzeuge.get("width")) {
				werkzeuge.set("width",Math.round(maxX+0.5));
			}//mm
			if(maxY>werkzeuge.get("height")){
				werkzeuge.set("height",Math.round(maxY+0.5));
			}//mm
			
			setLadebalken(100);
			resizeZF();
			setLadebalken(-1);
			
		}
		
		var loadSVG=function(fileName){
			_this.clear();//alte Zeichnung löschen
			setLadebalken(1);
			if(calcytimer!=undefined)clearTimeout(calcytimer);
			
			//var DOMURL = window.URL || window.webkitURL || window;
			var i,t,pfad,pl,property,svgpoint,drawline;
			Programmeinstellungen.dateiio.lastdateiname=fileName.split('.svg').join('.gcode');
			
			var blattwidth=werkzeuge.get("width");
			var blattheight=werkzeuge.get("height");
			
			var daten=fs.readFileSync(fileName, 'utf8');
			
			var scalieren=false;
			
			//Pfade aufsplitten
			if(daten.indexOf(" M")>-1){
				console.log("trenne Pfade");
				daten=daten.split(" M").join("\"/><path fill=\"none\" stroke=\"#000000\" d=\"M");
			}
			
			var svgdoc=document.createElement('svg');
			svgdoc.innerHTML=daten;
			
			var info=svgdoc.getElementsByTagName('svg')[0];
			console.log(info.getAttribute("version"));
			
			if(info.getAttribute("viewBox")==null){
				info.setAttribute("viewBox","0 0 "+info.getAttribute("width")+" "+info.getAttribute("height"));
			}
			console.log(info.getAttribute("viewBox"));//0 0 800 600
			
			var sarr=info.getAttribute("viewBox").split(' ');
			
			var dbox={"x":sarr[0],"y":sarr[1],"width":sarr[2],"height":sarr[3]};
			
			if(!confirm(getWort("scaletoblatt"))){
				//Blatt scalieren
				blattwidth=Math.floor(dbox.width/72*25.4);
				blattheight=Math.floor(dbox.height/72*25.4);
				werkzeuge.set("width",blattwidth);
				werkzeuge.set("height",blattheight);
				resizeZF();
			}else{
				//scalieren auf document oder 72dpi (mm=px/72dpi*25,4mm)
				scalieren=true;
			}
			
			
			var pxtommMul=Math.min(blattheight/dbox.height, blattwidth/dbox.width);
			
			var mulScaleDraw=Math.min(canvasZeichnung.height/dbox.height, canvasZeichnung.width/dbox.width);
			
			//console.log("mul?",blattheight/dbox.height,blattwidth/dbox.width);
			//console.log("mul>",pxtommMul);
			
			
			//https://developer.mozilla.org/en-US/docs/Web/API/SVGGeometryElement/getPointAtLength
			
			var soz,pfade,polyline,gesammtobjekte;
			var strichobjekte=['path','line','rect'];//ansich gehen nur Pfade...
			var xmin=dbox.width,xmax=0;
			var ymin=dbox.height,ymax=0;
			var tmp;
			
			if(scalieren===false){
				xmin=0;
				ymin=0;
				xmax=dbox.width;
				ymax=dbox.height;
			}
			console.log("scalieren",scalieren);
			
			var calcfunnr=-1;
			var schleifenz=0;
			
			var LinesToPolypaht=function(SVGdoc){
				var re=[],i,newNode, x1,y1,x2,y2;
				var lines=SVGdoc.getElementsByTagName('line');
				
				//<line fill="none" stroke="#000000" stroke-width="0.75" stroke-linecap="round" stroke-linejoin="round" x1="144.275" y1="369.835" x2="144.075" y2="346.735"/>
				//->
				//<polyline fill="none" stroke="#000000" stroke-width="0.75" stroke-linecap="round" stroke-linejoin="round" points="142.175,406.735 142.175,406.735 142.175,406.535"/>
				for(i=0;i<lines.length;i++){
					x1=lines[i].getAttribute("x1");
					y1=lines[i].getAttribute("y1");
					x2=lines[i].getAttribute("x2");
					y2=lines[i].getAttribute("y2");
					if(
						isNaN(parseFloat(x1)) || isNaN(parseFloat(x2)) ||
						isNaN(parseFloat(y1)) || isNaN(parseFloat(y2)) 
					){
						
					}
					else{
						newNode=document.createElement("polyline");
						newNode.setAttribute("points",x1+','+y1+' '+x2+','+y2);
						SVGdoc.appendChild(newNode);
					}
				}
				return re;
			}
			
			var calcpfade=function(){
					if(calcytimer!=undefined)clearTimeout(calcytimer);
					var point,attr;
					if(calcfunnr==-1){//get pfade/polyline
						//Linien zu polyline
						LinesToPolypaht(svgdoc);
						
						pfade=svgdoc.getElementsByTagName('path');
						polyline=svgdoc.getElementsByTagName('polyline');
						
						gesammtobjekte=pfade.length+polyline.length;
						if(gesammtobjekte==0){
									alert(getWort("notpfade"));
									return;
								}
						
						//<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="80.83px" height="17.27px" viewBox="0 0
						
						schleifenz=0;
						calcfunnr=0;
					}
					
					if(calcfunnr==0){//get min/max								
								
								i=schleifenz;
								
								if(i<pfade.length){
									//<path>
									pfad=pfade[i];//.getAttribute('d')
									pl=pfad.getTotalLength();									
									//console.log("pflength",pl);
									for(t=0;t<pl;t++){
										point=pfad.getPointAtLength(t);
										xmin=Math.min(point.x,xmin);
										ymin=Math.min(point.y,ymin);
										xmax=Math.max(point.x,xmax);
										ymax=Math.max(point.y,ymax);
									}
								}
								else{
									//<polyline>
									pfad=polyline[i-pfade.length];
									attr=pfad.getAttribute('points');
									
									attr=attr.split("\t").join('');
									attr=attr.split("\r").join('');
									attr=attr.split("\n").join('');
									attr=attr.split("  ").join('');
									pfad.setAttribute("points",attr);
									
									pl=attr.split(' ');
									for(t=0;t<pl.length;t++){
										point=pl[t].split(',');
										if(isNaN(parseFloat(point[0])) || isNaN(parseFloat(point[1]))){		
											//leerzeichen	
											//console.log(">>",attr,pl,point);
										}
										else{
											xmin=Math.min(parseFloat(point[0]),xmin);
											ymin=Math.min(parseFloat(point[1]),ymin);
											xmax=Math.max(parseFloat(point[0]),xmax);
											ymax=Math.max(parseFloat(point[1]),ymax);
										}
										
									}
								}
								
								setLadebalken(50/gesammtobjekte*i);
								
								schleifenz++;
								if(schleifenz==gesammtobjekte){
									calcfunnr=1;
									schleifenz=0;
								}
							
					}
					else
					if(calcfunnr==1){//grafik auf Blattformat scalieren
						setLadebalken(50);
						console.log(xmin,xmax,ymin,ymax);
						
						tmp=Math.min(blattwidth/(xmax-xmin), blattheight/(ymax-ymin));
						if(pxtommMul<tmp){
							pxtommMul=tmp;
							mulScaleDraw=Math.min(canvasZeichnung.height/(xmax-xmin), canvasZeichnung.width/(ymax-ymin));
						}
						
						console.log("scaleto",pxtommMul,mulScaleDraw);//,tmp,blattwidth/(xmax-xmin),blattheight/(ymax-ymin),Programmeinstellungen);
						schleifenz=0;
						calcfunnr=2;	
						
					}
					else
					if(calcfunnr==2){//zeichnen
							i=schleifenz;
						
							if(i<pfade.length){
								//path
								pfad=pfade[i];//.getAttribute('d')
								pl=pfad.getTotalLength();
								strichepunkte=[];
								setLadebalken(50+50/pfade.length*i);
								
								for(t=0;t<pl;t++){
									point=pfad.getPointAtLength(t);
									strichepunkte.push({
										x:(point.x-xmin)*pxtommMul,//mm
										y:(point.y-ymin)*pxtommMul, 
										px:(point.x-xmin)*mulScaleDraw,//pixel
										py:(point.y-ymin)*mulScaleDraw
										})
								}
								point=pfad.getPointAtLength(pl-0.01);
								strichepunkte.push({
										x:(point.x-xmin)*pxtommMul,
										y:(point.y-ymin)*pxtommMul, 
										px:(point.x-xmin)*mulScaleDraw,
										py:(point.y-ymin)*mulScaleDraw
										})
								
								createLinie();//zeichnet px/py,optimiert auf x/y aus strichepunkte
								
							}
							else{
								//polyline
								strichepunkte=[];
								pfad=polyline[i-pfade.length];								
								pl=pfad.getAttribute('points').split(' ');
								for(t=0;t<pl.length;t++){
									point=pl[t].split(',');
									if(isNaN(parseFloat(point[0])) || isNaN(parseFloat(point[1])) ){
										
									}
									else
									strichepunkte.push({
											x:(parseFloat(point[0])-xmin)*pxtommMul,
											y:(parseFloat(point[1])-ymin)*pxtommMul, 
											px:(parseFloat(point[0])-xmin)*mulScaleDraw,
											py:(parseFloat(point[1])-ymin)*mulScaleDraw
											})	
										
								}
								createLinie();
							}
							
							
							schleifenz++;
							if(schleifenz==gesammtobjekte){
								calcfunnr=3;
								schleifenz=0;
							}
					}
					else
					if(calcfunnr==3){//fertig
						setLadebalken(100);
						resizeZF();
						setLadebalken(-1);
						calcfunnr=4;
					}
					
					if(calcfunnr<4){
						calcytimer=setTimeout(calcpfade,1);
					}
			}
			
			
			//start Liniengenerierung
			calcpfade();
			
		}
		
		
		//--ini--
		var create=function(){			
			apptitel=document.title;
			
			basisnode=cE(zielNode,"div","zeichenfeld");
			
			canvasHG=cE(basisnode,"canvas","canHG");
			canvasHG.style.left=rand+'px';
			canvasHG.style.top=rand+'px';
			
			canvasVorlage=cE(basisnode,"canvas","canVorlage");
			canvasVorlage.style.left=rand+'px';
			canvasVorlage.style.top=rand+'px';
			
			canvasLines=cE(basisnode,"canvas","canLines");
			canvasLines.style.left=rand+'px';
			canvasLines.style.top=rand+'px';
			
			canvasZeichnung=cE(basisnode,"canvas","canZeichnung");
			canvasZeichnung.style.left=rand+'px';
			canvasZeichnung.style.top=rand+'px';
			
			ladebalken=cE(basisnode,"div","ladebalken");
			ladebalkenf=cE(ladebalken,"div","lbfill");
			setLadebalken(-1);
			
			canvasDraw=cE(basisnode,"canvas","canDraw");
			canvasDraw.style.left=rand+'px';
			canvasDraw.style.top=rand+'px';
			
			
			canvasDraw.addEventListener('mousemove',mausmove,false );			
			canvasDraw.addEventListener('mousedown',mausdown );
			canvasDraw.addEventListener('mouseup',mausup );
			canvasDraw.addEventListener('mouseout',mausout );
			
			window.addEventListener('keydown',keydown );
			window.addEventListener('keyup',keyup );
			window.addEventListener('resize',resizeZF );
			
			
		}
		
		create();
	}
	
	var refreshInputElemente=function(){
		var i,inp;
		for(i=0;i<inpElementeList.length;i++){
			inp=inpElementeList[i];
			if(	inp.getName()==getWort('dellaststroke')
				||
				inp.getName()==getWort('clearZeichnung')
				||
				inp.getName()==getWort('moveleft')
				||
				inp.getName()==getWort('moveright')
				||
				inp.getName()==getWort('movetop')
				||
				inp.getName()==getWort('movedown')
				||
				inp.getName()==getWort('scalemore')
				||
				inp.getName()==getWort('scaleless')
				||
				inp.getName()==getWort('exportgcode')
			){
				inp.inaktiv(zeichenfeld.getLineCount()==0);
			}
			if(	inp.getName()==getWort('delvorlage')){
				inp.inaktiv(!zeichenfeld.hatVorlage())
			}
			
		}
	}
	
	var inputElement=function(caption,typ,ziel,sEinheit,addtolist){
		var _this=this;
		var input;
		var blockdiv;
		var vmin=undefined;
		var vmax=undefined;
		var sendetimer=undefined;
		var valsendenin=250;//ms
		var basiselement=undefined;
		
		var fchange=undefined;
		var lokaldata=undefined;
		if(addtolist==undefined)addtolist=true;
		
		//--api--
		this.setMinMaxStp=function(min,max,step){
			if(min!=undefined){
				input.min=min;
				vmin=parseFloat(min);
			}
			if(max!=undefined){input.max=max;vmax=parseFloat(max)};
			if(step!=undefined)input.step=step;
		}
		
		this.inaktiv=function(b){
			input.disabled =b;
		}
		
		this.getName=function(){return caption;}
		
		this.setVal=function(val){
			if(input.type=="textarea"){
				input.innerHTML=val;
				input.value=val;
			}				
			else
			if(input.type=="checkbox")
				input.checked=val;
				else
				input.value=val;
		}
				
		this.getVal=function(){
			if(input.type=="checkbox")
				return input.checked;
				else
				return input.value;
		}
		
		this.getContainer=function(){return blockdiv;}
		
		this.setClass=function(c){
			basiselement.className=c;
			//addClass(blockdiv,c);
		}
		
		this.addEventFunc=function(func){
			fchange=func;
		}
		
		this.setdata=function(daten){lokaldata=daten;}
		this.getdata=function(){return lokaldata;}
		
		//--action--
		var inpchange=function(e){
			var senden=true;
			
			if(vmin!=undefined && input.value<vmin) senden=false;
			if(vmax!=undefined && input.value>vmax) senden=false;
			
			if(sendetimer!=undefined)clearTimeout(sendetimer);
			
			if(senden && fchange!=undefined)
				sendetimer=setTimeout(function(){
						if(lokaldata==undefined)
								fchange(input.value);
							else
								fchange(lokaldata);
					},valsendenin);
			e.preventDefault();//return false;
		}
		
		//--ini--
		var create=function(){
			var label,span,inpElementeNr=inpElementeList.length;
			var iid='input_'+typ+'_'+inpElementeNr;
			
			if(addtolist===false)iid=undefined;
			
			if(sEinheit!=undefined || typ!="button"){
				blockdiv=cE(ziel,"div");
				basiselement=blockdiv;
				}
			else{
				blockdiv=ziel;
				}
			
			
			if(typ!="button"){
				if(caption!=undefined){
					label=cE(blockdiv,"label");
					label.innerHTML=caption+':';
					addClass(label,"labeltext");
				}
			}			
			
			if(typ=="textarea")
				input=cE(blockdiv,typ,iid);		//textbox
				else{
				input=cE(blockdiv,"input",iid);
				input.type=typ;
				}
			
			if(typ=="button"  ){
				input.value=caption;
			}
			if(basiselement==undefined)basiselement=input;
							
			if(typ=="button"){
				//addClass(input,"button");
				input.addEventListener('click',inpchange);
				valsendenin=1;
			}else{
				input.addEventListener('change',inpchange);
				input.addEventListener('keyup',inpchange);
				input.addEventListener('mouseup',inpchange);
			}
			
			if(typ=="checkbox"){
				addClass(input,"booleanswitch");
				label=cE(blockdiv,"label");
				label.htmlFor=iid;
				valsendenin=100;
			}
			if(typ=="range"){
				valsendenin=10;
			}
						
			
			if(sEinheit!=undefined){
				span=cE(blockdiv,"span",undefined,"einheit");
				span.innerHTML=sEinheit;				
			}
			
			if(addtolist===true)inpElementeList.push(_this);
		}
		
		create();
	}
	
	//--Dialoge--
	var oDialog=function(){
		var dialognode;
		var dialogtitelnode;
		var dialogtitelbutt;
		var dialogcontentnode;
		var dialogaktiv=undefined;
		var _this=this;
		
		var closeDialog=function(e){
			_this.showDialog();
			e.preventDefault();//return false
		}
		
		var create=function(){
			dialognode=cE(zielNode,"div","dialog");
			dialogtitelnode		=cE(dialognode,"h1","dialogtitel");
			dialogtitelbutt		=cE(dialognode,"div","dialogtitelbutt");
			dialogcontentnode	=cE(dialognode,"div","dialogcontent");
			
			var node=cE(dialogtitelbutt,"a",undefined,"closebutton");
			node.href="#";
			node.innerHTML="X";
			node.addEventListener('click',closeDialog);
			node.title=getWort("buttclose");
			
			_this.showDialog();
		}
		
		var settitel=function(titeltext){
			dialogtitelnode.innerHTML=getWort(titeltext);
		}
		
		this.showDialog=function(dialogtyp){
			if(dialogtyp==undefined || dialogtyp==""){
				addClass(dialognode,"unsichtbar");
				if(dialogaktiv)dialogaktiv.destroy();
				return;
			}
			
			settitel('titel_'+dialogtyp);
			
			if(dialogtyp=="einstellungen"){
				dialogaktiv=new dialogEinstellungen(dialogcontentnode);
			}
			delClass(dialognode,"unsichtbar");
		}
		create();
	}
	
	var dialogEinstellungen=function(zielnode){
		var vorlageninputgruppe;
		
		var input_gcodeprestart,
			input_gcodestart,
			input_gcodeLinienbegin,
			input_gcodeLinienende,
			input_gcodeende,
			inpbutt_drawspeed,
			inpbutt_movespeed,
			inpbutt_vorlagenname,
			zielliste;
		
		this.destroy=function(){}
		
		var changegcodeElemente=function(v){
			Programmeinstellungen.gcodeoptionsV2[v.id]=v.node.getVal();
			saveSettings();
		};
		
		var addToVorlage=function(){
			var neueVorlage={
				"name":				inpbutt_vorlagenname.getVal(),
				"erasable":true,
				"gcodeprestart":	input_gcodeprestart.getVal(),
				"gcodestart":		input_gcodestart.getVal(),
				"gcodeLinienbegin":	input_gcodeLinienbegin.getVal(),
				"gcodeLinienende":	input_gcodeLinienende.getVal(),
				"gcodeende":		input_gcodeende.getVal(),
				"movespeed":		inpbutt_drawspeed.getVal(),	//max F5000
				"drawspeed":		inpbutt_movespeed.getVal()		//max F5000				
			}
			Programmeinstellungen.gcodevorlagen.push(neueVorlage);
			
			vorlagenauswahl(zielliste);
			
			inpbutt_vorlagenname.setVal("Vorlage "+Programmeinstellungen.gcodevorlagen.length);
			
			saveSettings();
		}
		
		var create=function(){
			zielnode.innerHTML="";
			var gruppe,table,tr,td,node,inpbutt;
			
			
			//Vorlagen: plotter, Laser:  name-load-del
			// 
			zielliste=cE(zielnode,"article","vorlagenwahl");
			vorlagenauswahl(zielliste);
			
			vorlageninputgruppe=cE(zielnode,"article");
			table=cE(vorlageninputgruppe,"table",undefined,"gcodinputtabelle");
			
			input_gcodeprestart=new inputElement(getWort('gcodeprestart'),'textarea',table,undefined,false);
			input_gcodeprestart.setClass('inputtextfeld');
			input_gcodeprestart.setVal(Programmeinstellungen.gcodeoptionsV2.gcodeprestart);
			input_gcodeprestart.setdata({"node":input_gcodeprestart,"id":"gcodeprestart"});
			input_gcodeprestart.addEventFunc(changegcodeElemente);
			
			input_gcodestart=new inputElement(getWort('gcodestart'),'textarea',table,undefined,false);
			input_gcodestart.setClass('inputtextfeld');
			input_gcodestart.setVal(Programmeinstellungen.gcodeoptionsV2.gcodestart);
			input_gcodestart.setdata({"node":input_gcodestart,"id":"gcodestart"});
			input_gcodestart.addEventFunc(changegcodeElemente);
			
			input_gcodeLinienbegin=new inputElement(getWort('gcodeLinienbegin'),'textarea',table,undefined,false);
			input_gcodeLinienbegin.setClass('inputtextfeld');
			input_gcodeLinienbegin.setVal(Programmeinstellungen.gcodeoptionsV2.gcodeLinienbegin);
			input_gcodeLinienbegin.setdata({"node":input_gcodeLinienbegin,"id":"gcodeLinienbegin"});
			input_gcodeLinienbegin.addEventFunc(changegcodeElemente);
			
			input_gcodeLinienende=new inputElement(getWort('gcodeLinienende'),'textarea',table,undefined,false);
			input_gcodeLinienende.setClass('inputtextfeld');
			input_gcodeLinienende.setVal(Programmeinstellungen.gcodeoptionsV2.gcodeLinienende);
			input_gcodeLinienende.setdata({"node":input_gcodeLinienende,"id":"gcodeLinienende"});
			input_gcodeLinienende.addEventFunc(changegcodeElemente);
			
			input_gcodeende=new inputElement(getWort('gcodeende'),'textarea',table,undefined,false);
			input_gcodeende.setClass('inputtextfeld');
			input_gcodeende.setVal(Programmeinstellungen.gcodeoptionsV2.gcodeende);
			input_gcodeende.setdata({"node":input_gcodeende,"id":"gcodeende"});
			input_gcodeende.addEventFunc(changegcodeElemente);
			
			vorlageninputgruppe=cE(zielnode,"article",undefined,"input2");
			inpbutt_movespeed=new inputElement(getWort('movespeed'),'number',vorlageninputgruppe,'mm/min',false);
			inpbutt_movespeed.setVal(Programmeinstellungen.gcodeoptionsV2.movespeed);
			inpbutt_movespeed.setMinMaxStp(500,5000);
			inpbutt_movespeed.setdata({"node":inpbutt_movespeed,"id":"movespeed"});
			inpbutt_movespeed.addEventFunc(changegcodeElemente);
		
			inpbutt_drawspeed=new inputElement(getWort('drawspeed'),'number',vorlageninputgruppe,'mm/min',false);
			inpbutt_drawspeed.setVal(Programmeinstellungen.gcodeoptionsV2.drawspeed);
			inpbutt_drawspeed.setMinMaxStp(500,5000);
			inpbutt_drawspeed.setdata({"node":inpbutt_movespeed,"id":"drawspeed"});
			inpbutt_drawspeed.addEventFunc(changegcodeElemente);
			
			
			
			inpbutt_vorlagenname=new inputElement(getWort('vorlagenname'),'text',vorlageninputgruppe,undefined,false);
			inpbutt_vorlagenname.setVal("Vorlage "+Programmeinstellungen.gcodevorlagen.length);
			inpbutt_vorlagenname.addEventFunc(function(v){});
			
			
			inpbutt=new inputElement(getWort('addtovorlage'),'button',inpbutt_vorlagenname.getContainer(),undefined,false);
			inpbutt.addEventFunc(function(v){addToVorlage()});
			
			
			gruppe=cE(zielnode,"article");
			node=cE(gruppe,"p");
			node.innerHTML=getWort("gcodeplatzhaltertext");
			
			//TODO:
			//als Vorlage speichern
			//-> Programmeinstellungen.gcodeoptionsV2 ...
		}
		
		var setdatenvonvorlage=function(data){
			console.log(data);		
			input_gcodeprestart.setVal(data.daten.gcodeprestart);
			input_gcodestart.setVal(data.daten.gcodestart);
			input_gcodeLinienbegin.setVal(data.daten.gcodeLinienbegin);
			input_gcodeLinienende.setVal(data.daten.gcodeLinienende);
			input_gcodeende.setVal(data.daten.gcodeende);
			inpbutt_drawspeed.setVal(data.daten.drawspeed);
			inpbutt_movespeed.setVal(data.daten.movespeed);
			
			Programmeinstellungen.gcodeoptionsV2.gcodeprestart=data.daten.gcodeprestart;
			Programmeinstellungen.gcodeoptionsV2.gcodestart=data.daten.gcodestart;
			Programmeinstellungen.gcodeoptionsV2.gcodeLinienbegin=data.daten.gcodeLinienbegin;
			Programmeinstellungen.gcodeoptionsV2.gcodeLinienende=data.daten.gcodeLinienende;
			Programmeinstellungen.gcodeoptionsV2.drawspeed=data.daten.drawspeed;
			Programmeinstellungen.gcodeoptionsV2.movespeed=data.daten.movespeed;
			saveSettings();
			
		}
		
		var delvorlage=function(data){
			var i,nr=data.nr;
			var newliste=[];
			for(i=0;i<Programmeinstellungen.gcodevorlagen.length;i++){
				if(i!=nr)newliste.push(Programmeinstellungen.gcodevorlagen[i]);
			}
			Programmeinstellungen.gcodevorlagen=newliste;
			saveSettingsNow();
			create();
		}
		
		var vorlagenauswahl=function(ziel){
			var i,datavorlage,node,ul,li,inpbutt;
			//nodeinput=new inputElement('','liste',ziel,'');
			ziel.innerHTML="";
			ul=cE(ziel,"ul");
			for(i=0;i<Programmeinstellungen.gcodevorlagen.length;i++){
				datavorlage=Programmeinstellungen.gcodevorlagen[i];
				li=cE(ul,'li');
				node=cE(li,'span');
				node.innerHTML=datavorlage.name;
				
				inpbutt=new inputElement(getWort('loadvorlage'),'button',li,undefined,false);
				inpbutt.setdata({nr:i,daten:datavorlage});
				inpbutt.addEventFunc( function(v){setdatenvonvorlage(v);});
			
				if(!(datavorlage.erasable===false)){
					inpbutt=new inputElement(getWort('deletevorlage'),'button',li,undefined,false);
					inpbutt.setdata({nr:i,daten:datavorlage});
					inpbutt.addEventFunc( function(v){delvorlage(v);});
				}
			}
		}
		
		create();
	}

}

//Start nach dem Laden
window.addEventListener('load', function (event) {
		var oProgramm_app;
		oProgramm_app=new electron_app();
		oProgramm_app.ini("myapplication");
	});
