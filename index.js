#!/usr/bin/env node

const unirest = require('unirest')				//On récupère ici tous les modules
const program = require('commander')
const db = require('sqlite')
const inquirer = require('inquirer')
const fs = require('fs')

//configuration des paramètres attendus
//program.

program 										//On utilise commander pour proposer plusieurs choix à l'utilisateurs, que nous allons ensuite traiter dans une série de if/else if
	.version('1.0.0')
	.option('-s, --search [name]', 'Search for a game by its name, please enter the game\'s name between double quotes')
	.option('-n, --number [number]', 'Enter the number of results wanted (default : 1)')
	.option('-a, --add [name]', 'Add a game in the database, please enter the game\'s name between double quotes (Note that you can only had one game at a time.')
	.option('-d, --delete [name]', 'delete a game in the database, please enter the game\'s name between double quotes')
	.option('-f, --fetch', 'Pick every game\' score in the "games" table to put them in the "scores" table')
	.option('-g, --game [name]', 'Give you more options for a specific game')
	.option('-l, --list', 'Display every games in the database')
	.option('-t, --save', 'Save every games in your bookmarks in a file')
	.option('-c, --clear', 'Clear a table from the DataBase')

//On parse ( convertit en format utilisable) les options
// => Fonction synchrone
program.parse(process.argv)						// On parse ce que l'utilisateur à taper pour qu'on puise utiliser ces données

db.open('ign.db').then(() => {					//Ici, on crée les trois table de la BDD si elles n'existent pas encore. On note que les trois db.run sont dans un Promise.all. Cela nous sert à passer à la suite quand les trois table sont crée. Cela permet également de les créer en même temps.
	return Promise.all([
		db.run('CREATE TABLE IF NOT EXISTS games (title, score, publisher, descr)'),
		db.run('CREATE TABLE IF NOT EXISTS scores (title, score)'),
		db.run('CREATE TABLE IF NOT EXISTS bookmarks (title, score, publisher, descr)')
	])
}).then(() => {									//Suite de promesse basique. Si la promesse est acomplie, on passe dans ce then et on afficher que la bdd est prête.
	console.log('> DataBase ready !\n')
}).catch((err) => {								// Si la promesse renvois une erreur, on arrive dans le catch et on affiche l'erreur.
	console.error('Err => ', err)			
}).then(() => {

	if(program.delete){							//Voilà le début du if qui traîte les paramètre donné par l'utilisateur grâce à commander.

		db.run(`DELETE FROM games WHERE title="${program.delete}"`)			//Ici, on supprime le jeu spécifié après le paramètre -d
		.then(() => {
			console.log("Delete grom games Successfull")
		}).catch((err) => {
			console.log ('Err => ', err)
		})
	}else if(program.fetch){

		db.all('SELECT title, score FROM games').then((game) => {			//Ici, on vient chercher le titre d'un jeu avec son score pour le stocker dans la table scores

			if(!game[0])
				return console.log("Empty DataBase !\n Program closing...")		//Ce if sert à ce que, si la table games est vide, on sorte de la fonction.

			db.run('INSERT INTO scores VALUES (?, ?)', game.title, game.score)
			.then(() => {
				console.log("Insert into scores Successfull")
			}).catch((err) => {
				console.log ('Err => ', err)
			})
		}).catch((err) => { // On gère les erreurs
			console.error('Err => ', err)
		})  			

	}else if(program.game){														//Ici, nous allons proposer plusieurs choix à l'utilisateurs pour un jeu qu'il aura précisé après son paramètre.
		if(program.game === true)
			return console.log("You must specify a game name !\n Program closing...")

		inquirer.prompt([{																//Inquirer nous permet de demander à l'utilisateur ce qu'il veut faire avec le jeu qu'il a nommé. Une checkbox avec plusieurs choix lui est proposé.
			type: 'checkbox',
			message: `What do you want to do with ${program.game} ?`,
			name: 'action',
			choices: [
				'Display game Informations',
				'Delete the game from the DataBase',
				'Save the game in your bookmarks',
				'Nothing, I have changed my mind, sorry'
			]
		}]).then((answers) => {

			for (var i = 0, l = answers.action.length ; i < l; i++) {									//On parcours le tableau des réponses pour être sûr de toutes les prendres.

				if(answers.action[i] === "Display game Informations"){
					db.all(`SELECT * FROM games WHERE title="${program.game}"`).then((game) => {		//Si le choix était de connaître les infos du jeu, on lui affiche tout simplement, avec un peu de formes.

		  				if(!game[0])
		  					return console.log("\nThe game is not in the DataBase. Try to add it fisrt !\n Program closing...")
		    			
		    			for (var i = 0, l = game.length ; i < l; i++) {
		    				console.log("\nGame : ", game[i].title)
		    				console.log("Score : ", game[i].score)
		    				console.log("Publisher : ", game[i].publisher)
		    				console.log("Short Description : ", game[i].descr, "\n")
		    			}
		  			}).catch((err) => { // On gère les erreurs
		  				console.error('Err => ', err)
				  	})
				}else if(answers.action[i] === "Delete the game from the DataBase"){					//Si le choix était de supprimer le jeu de la BDD, on execute sa demande.
				
					db.run(`DELETE FROM games WHERE title="${program.game}"`)
					.then(() => {
						console.log("Delete grom games Successfull")
					}).catch((err) => {
						console.log ('Err => ', err)
					})
				}else if(answers.action[i] === "Save the game in your bookmarks"){												//S'il veut l'enregistrer dans ses favoris, on récupère toutes les infos du jeu en question pour les enregistrer dans une autre table, bookmarks.
					db.get(`SELECT COUNT(*) as count FROM bookmarks WHERE title="${program.game}"`).then((data) => {

						if(data.count >= 1)																						//On retourne une Promise.reject si jamais le jeu est déjà dans la liste pour passer directement au catch en évitant les then suivant.
							return Promise.reject("The game is alerady in your bookmarks !\n Program closing...")				//Le test est relativement simple, on compte le nombre de colonnes dans la table games pour lesquels le titre est similaire au nom du jeu passer en paramètre. S'il est supérieur ou égal à 1, c'est que le jeu est déjà présent et qu'il n'est pas nécessaire de le ré-ajouter.
					}).then(() => {
						return db.all(`SELECT * FROM games WHERE title="${program.game}"`)
					}).then((game) => {

						if(!game[0])
							return console.log("Empty DataBase !\n Program closing...")

						db.run('INSERT INTO bookmarks VALUES (?, ?, ?, ?)', game[0].title, game[0].score, game[0].publisher, game[0].descr)			//Si tout se passe bien et que le jeu n'est pas déjà présent, on l'ajoute juste.
						.then(() => {
							console.log("\nInsert into bookmarks Successfull")
						}).catch((err) => {
							console.log ('Err => ', err)
						})

					}).catch((err) => { // On gère les erreurs
				   		console.error('Err => ', err)
					})
				}else if(answers.action[i] === "Nothing, I have changed my mind, sorry"){										//Petite option supplémentaire de la checkbox qui permet juste à l'utilisateur de quitter le programme sans rien faire.
					return console.log("Have a great day anyway !")
				}
	    	}
		})

	}else if(program.list){

		db.all('SELECT * FROM games').then((game) => {

			if(!game[0])
				return console.log("Empty DataBase !\n Program closing...")														//Ici, on liste juste en bonne et due forme les jeux présent dans la table games.
	    			
			for (var i = 0, l = game.length ; i < l; i++) {
				console.log("Game : ", game[i].title)
				console.log("Score : ", game[i].score)
				console.log("Publisher : ", game[i].publisher)
				console.log("Short Description : ", game[i].descr, "\n")
			}

		}).catch((err) => { // On gère les erreurs
			console.error('Err => ', err)
		})

	}else if(program.save){
		db.all('SELECT * FROM bookmarks').then((game) => {																		//Ici, on sauvegarde les jeux présent dans la table bookmarks dans un fichier.

			if(!game[0])
	  			return console.log("Empty DataBase !\n Program closing...")

	    	for (var i = 0, l = game.length ; i < l; i++) {
		    	fs.appendFile('bookmarks.txt',`Game : ${game[i].title}\r\nScore : ${game[i].score}\r\nPublisher : ${game[i].publisher}\r\nShort Description ! ${game[i].descr}\r\n\r\n`,    //Effectivement, je pense que cette fonction pique les yeux, mais je ne savais pas vraiment ocmment faire de manière propre.
		    		(err) => {																																								//Comme je l'ai dit, il me semble que l'on peut utiliser les writeStream, mais je n'ai pas vraiment compris leur utilisation.
						if (err){
			  				console.error('Can\'t read/write on the file')
			  			}
						console.log('It\'s saved!');
					})
	    	}

	  	}).catch((err) => { // On gère les erreurs
	    	console.error('Err => ', err)
	  	})
	    
	}else if(program.clear){

		inquirer.prompt([{
			type: 'checkbox',
			message: `Which table do you want to clear ?`,								//Encore une checkbox avec inquirer pour faire en sorte que l'utilisateur puisse clear les tables de la base.
			name: 'action',																
			choices: [
				'games',
				'scores',
				'bookmarks'
			]
		}]).then((answers) => {

			for (var i = 0, l = answers.action.length ; i < l; i++) {

				db.run(`DELETE FROM ${answers.action[i]}`)				//J'ai essayé d'utiliser TRUNCATE TABLE à la place du DELETE, mais cela ne marchait pas, jen 'ai pas vraiment compris d'où venait le problème.
				.then(() => {
					console.log(`Table has been cleared.`)
				}).catch((err) => {
					console.log ('Err => ', err)
				})
			}
		})

	}else if (program.search || program.add){

		unirest.get(`https://videogamesrating.p.mashape.com/get.php?count=${program.number || 1}&game=${program.search || program.add || program.delete}`)		//C'est ici que l'on appelle l'API pour récupérer les informations à la base.
		.header("X-Mashape-Key", "TE6f9xPsD3msh0bh2Lmqps4TXHu0p1lSq1ajsnAduMimzvfe7W")
		.header("Accept", "application/json")
		.end(function (result) {

				var response = result.body

				if (program.search){
					if(!response || !response[0])
						return console.log("Response Error")							//Si jamais rien est trouvé, on affiche une erreur.

		  			for (var i = 0, l = response.length ; i < l; i++) {					//On affiche les informations sur le jeu demandé.
		    			console.log("Game :", response[i].title)
		    			console.log("Score :", response[i].score, "/10")
		    			console.log("Publisher :", response[i].publisher)
		    			console.log("Short Description :", response[i].short_description, "\n")
		    		}

				}else if(program.add){
					if(!response || !response[0])
						return console.log("Response Error")

					db.get(`SELECT COUNT(*) as count FROM games WHERE title="${program.add}"`).then((data) => {		//Même petit test que tout à l'heure pour vérifier que le jeu demandé n'est pas déjà dans la table.

		  				if(data.count >= 1)
		  					return Promise.reject("The game is alerady in the DataBase !\n Program closing...")
		  			}).then(() => {
		  				return db.run('INSERT INTO games VALUES (?, ?, ?, ?)', response[0].title, response[0].score, response[0].publisher, response[0].short_description)		//On ajoute le jeu demandé dans la table games.
		  			}).then(() => {
						console.log("Insert into games Successfull")
					}).catch((err) => { // On gère les erreurs
		    			console.error('Err => ', err)
		  			})

				}
			
		});
	}else {
		program.help()	//Si jamais l'utilisateur ne rentre pas de paramètre, ou un paramètre erroné, l'aide lui sera affiché.
	}
})