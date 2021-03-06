function Player(playerData) {
  return {
    data: playerData,
    metadata: {
      seed: Math.floor(Math.random() * 1000000),
      points: {
        game: 0,
        match: 0,
      },
      percentage: {
        match: {
          self: 0,
          opponent: 0,
        },
        game: {
          self: 0,
          opponent: 0,
        },
      },
      opponents: []
    },
    matchPoints () { return this.metadata.points.match },
    opponentsMatchWinPercentage() { return this.metadata.percentage.match.opponent },
    gameWinPercentage() { return this.metadata.percentage.game.self },
    opponentsGameWinPercentage() { return this.metadata.percentage.game.opponent },
    random() { return this.metadata.seed },
    updateWinPercentage(type, roundsPlayed) {
      this.metadata.percentage[type].self = Math.max(this.metadata.points[type] / roundsPlayed * 3, 0.33);
    },
    updateOpponentWinPercentage(type) {
      this.metadata.percentage[type].opponent = (
        this.metadata.opponents.map(
          (p) => p.metadata.percentage[type].self
        ).reduce(
          (acc, v) => (acc || 0) + v
        ) / this.metadata.opponents.length
      );
    },
  };
}

function Pairing(...players) {
  const [p1, p2] = players;
  const opponents = new Map([[p1, p2],[p2, p1]]);
  const bye = players.length === 1;
  return {
    players: new Map(players.map((p) => [p.data.id, { player: p, opponent: opponents.get(p), wins: bye ? 2 : 0 }])),
    draws: 0,
    state: bye ? 'confirmed' : 'unsubmitted',
    bye
  };
}

function Tournament() {
  return {
    state: 'not_running',
    players: [],
    rounds: [],
    currentRound: 0,

    checkin() {
      if (this.state === 'not_running') {
        this.state = 'checkin'
        return 'Tournament now in check-in stage';
      }

      return 'Sorry, I can only run one tournament at a time.';
    },

    add(playerData) {
      if (this.findPlayer(playerData)) {
        return `${playerData} already in the tournament!`;
      }

      this.players.push(new Player(playerData));

      return `${playerData} joined the tournament!`;
    },

    start() {
      if (this.state !== 'checkin') {
        return 'Tournament check-in not initiated';
      }

      // update state
      this.state = 'running';
      // calculate number of rounds
      let totalRounds = 0
      let k = this.players.length;

      while (k > 1) {
        k = k/2;
        totalRounds = totalRounds + 1;
      }
      totalRounds = Math.max(totalRounds, 3);

      let r = 0;
      while (r < totalRounds) {
        this.rounds.push({pairings: []});
        r = r + 1;
      }

      this.generatePairings(['random']);

      // output Initial info
      let header = `Number of players: ${this.players.length}\n` +
        `Number of rounds: ${this.rounds.length}\n\n`+
        `Pairings for Round ${this.currentRound + 1}:`

      return [header, this.outputPairings(this.currentRound)];
    },

    outputPairings(round) {
      let output = [];
      let table = 0;
      while(table < this.rounds[round].pairings.length) {
        let row = `Table ${table + 1}: `
        if (this.rounds[round].pairings[table].bye) {
          row = row + `${this.rounds[round].pairings[table].players.values().next().value.player.data} -- BYE`;
        } else {
          row = row + Array.from(this.rounds[round].pairings[table].players, ([key, pairingData]) => pairingData.player.data).join(' vs ');
        }
        output.push(row);
        table = table + 1;
      }
      return output;
    },

    submitResult(playerData, win = 2, loss = 0, draw = 0) {
      const pairing = this.findPairing(playerData);
      console.log(pairing);
      if (!pairing) {
        return `Sorry ${playerData}, is not playing.`;
      }

      if (pairing.state === 'unsubmitted') {
        pairing.players.get(playerData.id).wins = win;
        pairing.players.get(pairing.players.get(playerData.id).opponent.data.id).wins = loss;
        pairing.draws = draw;
        pairing.state = 'submitted';
        let output = `Result submitted by ${playerData}:\n`
        output = output + `${playerData} wins: ${win}\n`;
        output = output + `${pairing.players.get(playerData.id).opponent.data} wins: ${loss}\n`;
        output = output + `Draws: ${draw}\n`;
        output = output + `${pairing.players.get(playerData.id).opponent.data} please confirm.`;
        return [output, pairing.players.get(playerData.id).opponent.data];
      }
      return 'Error';
    },

    confirmResult(playerData) {
      const pairing = this.findPairing(playerData);
      if (!pairing) {
        return `Sorry ${playerData}, is not playing.`;
      }

      if (pairing.state === 'submitted') {
        pairing.state = 'confirmed';
        return `${pairing.players.get(playerData.id).opponent.data}, ${playerData} confirmed the result!\nDon't forget to shake hands (and wash them afterwards)!`;
      }
      return 'Error';
    },

    denyResult(playerData) {
      const pairing = this.findPairing(playerData);
      if (!pairing) {
        return `Sorry ${playerData}, is not playing.`;
      }

      if (pairing.state === 'submitted') {
        pairing.state = 'unsubmitted';
        return `${pairing.players.get(playerData.id).opponent.data}, ${playerData} didn't accept the result you submitted.\n Please revise the result and resubmit!`;
      }

      return 'Error';
    },

    findPlayer(playerData) {
      return this.players.find((p) => p.data.id === playerData.id);
    },

    findPairing(playerData) {
      return this.rounds[this.currentRound].pairings.find((pairing) => pairing.players.has(playerData.id));
    },

    updateScore(participant, gameWins, gameDraws, matchWins, matchDraws) {
      participant.player.metadata.points.game = participant.player.metadata.points.game + (gameWins * 3) + gameDraws;
      participant.player.metadata.points.match = participant.player.metadata.points.match + (matchWins * 3) + matchDraws;
    },

    updateScores(pairing) {
      pairing.state = 'confirmed'
      const players = pairing.players.values();
      const p1 = players.next().value;
      if (pairing.bye) {
        this.updateScore(p1, 2, 0, 1, 0);
        return;
      }

      const p2 = pairing.players.get(p1.opponent.data.id);
      this.updateScore(p1, p1.wins, pairing.draws, p1.wins > p2.wins ? 1 : 0, p1.wins === p2.wins ? 1 : 0);
      this.updateScore(p2, p2.wins, pairing.draws, p2.wins > p1.wins ? 1 : 0, p2.wins === p1.wins ? 1 : 0);
    },

    nextRound() {
      // gather results
      this.rounds[this.currentRound].pairings.forEach((p) => this.updateScores(p));

      // store each players tiebreakers
      this.players.forEach((p) => {
        p.updateWinPercentage('match', this.currentRound);
        p.updateWinPercentage('game', this.currentRound);
      });
      this.players.forEach((p) => {
        p.updateOpponentWinPercentage('match');
        p.updateOpponentWinPercentage('game');
      });

      // increment round
      this.currentRound = this.currentRound + 1;
      // pair players according to tiebreakers

      this.generatePairings([
        'matchPoints',
        'opponentsMatchWinPercentage',
        'gameWinPercentage',
        'opponentsGameWinPercentage',
        'random'
      ]);
      // output pairings
      const header = `Pairings for ${this.currentRound + 1}:`
      return [header, this.outputPairings(this.currentRound)];
    },

    generatePairings(tiebreakers) {
      const sortedPlayers = this.players.slice().sort((a, b) => {
        function innerSort(i) {
          if (i >= tiebreakers.length) {
            return 0;
          }
          if (a[tiebreakers[i]]() > b[tiebreakers[i]]()) {
            return -1;
          }
          if (a[tiebreakers[i]]() < b[tiebreakers[i]]()) {
            return 1;
          }
          if (a[tiebreakers[i]]() === b[tiebreakers[i]]()){
            return innerSort(i + 1);
          }
        }
        return innerSort(0);
      });

      while(sortedPlayers.length > 0) {
        const player = sortedPlayers.shift();
        const i = sortedPlayers.findIndex((p) => !player.metadata.opponents.includes(p));
        if (i === -1) {
          this.rounds[this.currentRound].pairings.push(new Pairing(player));
        } else {
          const [opponent] = sortedPlayers.splice(i, 1);
          player.metadata.opponents.push(opponent);
          opponent.metadata.opponents.push(player);
          this.rounds[this.currentRound].pairings.push(new Pairing(player, opponent));
        }
      }
    }
  }
}

// Match points
// Opponents’ match-win percentage
// Game-win percentage
// Opponents’ game-win percentage

export default Tournament;
