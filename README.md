#Wozu das ganze?#

Mit diesem Programm kann man Zeichnungen erstellen um sie später auszuplotten.

Die Zeichnungen werden im gcode-Format gespeichert.

Für die Ausführung ist ein Gerät mit Marlin-Firmeware von nöten, das ein Servo für den Stifthalter benutzt.
Ich werde "Marlin 1.1.0-RC6" auf einem Rumba-Board nutzen.


#Projekt bearbeiten#

Für die Bearbeitung diese Projektes benötigt man:<br>
https://nodejs.org dabei ist der npm-Packetmanager<br>
mit<br>
> npm install --global electron

wird electron global installiert.
mit<br>
> npm install electron-builder

kommt noch der builder zum packen des Projektes hinzu.

In der Eingabeaufforderung kann, im Verzeichnis des Projektes mit<br>
> electron .

das Programm gestartet werden (Entwicklungsversion).<br>
Mit<br>
> build

kann ein Packet zur Installation erzeugt werden.
Das kann dann wie jedes normale Programm von Nutzern installiert werden. 
Das Installationsprogramm ist dann im Verzeichnis `dist` zu finden.


