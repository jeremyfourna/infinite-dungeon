/* jshint esversion:6 */

/////////////////
// Definition //
///////////////

const hero = {
  name: 'Hero',
  level: 1,
  hp: 100,
  mp: 20,
  attacks: [{
    cost: 0,
    damage: 10,
    loading: 1,
    name: 'Kick',
    origin: 'hero',
    target: 'monster'
  }, {
    cost: 5,
    damage: 50,
    loading: 5,
    name: 'H20',
    origin: 'hero',
    target: 'monster'
  }],
  stack: [],
  currentAttack: null
};

////////////////////////////////////
// Generate battle and render it //
//////////////////////////////////

const battle = generateBattle(hero);
battle.render();

////////////
// Utils //
//////////

function render(domId, content) {
  const parser = new DOMParser();
  const doc = R.path(['body', 'innerHTML'], parser.parseFromString(content, 'text/html'));
  const domElements = document.querySelectorAll(domId);

  R.forEach(cur => cur.innerHTML = doc, domElements);
}

function template(view, list) {
  const mapIndexed = R.addIndex(R.map);

  return R.join('', mapIndexed(view, list));
}

////////////////////
// Battle engine //
//////////////////

function generateBattle(hero) {
  const p = R.prop(R.__, hero);
  const store = {
    hero,
    monster: {
      name: 'Big Dragon',
      hp: R.multiply(400, p('level')),
      mp: R.multiply(100, p('level')),
      attacks: [{
        cost: 0,
        damage: 10,
        loading: 1,
        name: 'Claw',
        origin: 'monster',
        target: 'hero'
      }, {
        cost: 12,
        damage: 50,
        loading: 8,
        name: 'Fire breath',
        origin: 'monster',
        target: 'hero'
      }],
      stack: [],
      currentAttack: null
    }
  };

  return {
    canAttack: (who, cost) => (store[who].mp - cost >= 0) ? true : false,
    loadAttack: (attack) => {
      store[attack.origin].stack.push(attack);
      if (R.isNil(store[attack.origin].currentAttack)) {
        store[attack.origin].currentAttack = asyncAttack(attack.loading, attack);
      }
    },
    loseMP: (toWho, amount) => store[toWho].mp -= amount,
    loseHP: (toWho, amount) => store[toWho].hp -= amount,
    nextAttack: (who) => {
      store[who].stack.splice(0, 1);
      if (!R.isEmpty(store[who].stack)) {
        const nextAttack = R.head(store[who].stack);
        store[who].currentAttack = asyncAttack(nextAttack.loading, nextAttack);
      }
    },
    removeAttackFromStack: (who, indexInStack) => store[who].stack.splice(indexInStack, 1),
    render: () => render('#battle', template(fighterView, [store.hero, store.monster])),
    restoreMP: (toWho, amount) => store[toWho].mp += amount,
    stack: (who) => store[who].stack,
    store: () => store,
    currentAttack: (who, value = undefined) => {
      if (R.equals(value, undefined)) {
        return store[who].currentAttack;
      } else {
        store[who].currentAttack = value;
        return store[who].currentAttack;
      }
    }
  };
}




// attackView :: object -> string
function attackView(attack) {
  // isAttackPossible :: boolean -> null || string
  function isAttackPossible(possibleOrNot) {
    return (possibleOrNot) ? null : 'disabled="true"';
  }

  const p = R.prop(R.__, attack);
  const isPossible = isAttackPossible(battle.canAttack(p('origin'), p('cost')));

  registerEvents(
    [{
      type: 'click',
      funct: registerAttack
    }]
  );

  return `<button
            class="attack"
            ${isPossible}
            data-cost="${p('cost')}"
            data-damage="${p('damage')}"
            data-loading="${p('loading')}"
            data-name="${p('name')}"
            data-origin="${p('origin')}"
            data-target="${p('target')}"
            data-function-identifier="attack"
            >
            ${p('name')}
          </button>`;
}

// stackView :: (object, number) -> string
function stackView(nextAttack, index) {
  const p = R.prop(R.__, nextAttack);
  const canRemoveAttackFromStack = (R.equals(0, index)) ? 'disabled="true"' : null;

  registerEvents(
    [{
      type: 'click',
      funct: cancelAttack
    }]
  );

  return `<li>
            ${p('name')}
            <button
              ${canRemoveAttackFromStack}
              data-cost="${p('cost')}"
              data-origin="${p('origin')}"
              data-function-identifier="cancelAttack"
              data-stack-index="${index}"
              >
              X
            </button>
          </li>`;
}

// fighterView :: object -> string
function fighterView(fighterStatus) {
  const p = R.prop(R.__, fighterStatus);

  return `<div class="fighter">
            <h2>${p('name')}</h2>
            <h3>HP ${p('hp')}</h3>
            <p>MP ${p('mp')}</p>
            <div>${template(attackView, p('attacks'))}</div>
            <div>
              <ul>${template(stackView, p('stack'))}</ul>
            </div>
          </div>`;
}

// loadingToMillisec :: number -> number
function loadingToMillisec(loading) {
  return R.multiply(loading, 1000);
}

// registerAttack :: DOM event -> void
function registerAttack(event) {
  const p = R.prop(R.__, R.path(['target', 'dataset'], event));

  if (R.equals(p('functionIdentifier'), 'attack') && battle.canAttack(p('origin'), Number(p('cost')))) {
    loadAttack({
      cost: Number(p('cost')),
      damage: Number(p('damage')),
      loading: p('loading'),
      name: p('name'),
      origin: p('origin'),
      target: p('target')
    });
  }
}

// removeAttackFromStack :: object -> void
function removeAttackFromStack(attack) {
  const p = R.prop(R.__, attack);

  battle.restoreMP(p('origin'), p('cost'));
  battle.removeAttackFromStack(p('origin'), p('stackIndex'));
  battle.render();
}

function cancelAttack(event) {
  const p = R.prop(R.__, R.path(['target', 'dataset'], event));

  if (R.equals(p('functionIdentifier'), 'cancelAttack')) {
    removeAttackFromStack({
      cost: Number(p('cost')),
      stackIndex: p('stackIndex'),
      origin: p('origin'),
    });
  }
}

function asyncAttack(delay, params) {
  return window.setTimeout(applyAttack, loadingToMillisec(delay), params);
}


function registerEvents(listOfEvents) {
  return R.forEach(cur => {
    const p = R.prop(R.__, cur);
    document.body.addEventListener(p('type'), p('funct'), false);
  }, listOfEvents);
}

function applyAttack(attack) {
  const p = R.prop(R.__, attack);

  battle.loseHP(p('target'), p('damage'));
  battle.currentAttack(p('origin'), null);
  battle.nextAttack(p('origin'));
  battle.render();
}

function loadAttack(attack) {
  const p = R.prop(R.__, attack);

  battle.loseMP(p('origin'), p('cost'));
  battle.loadAttack({
    cost: p('cost'),
    damage: p('damage'),
    loading: p('loading'),
    name: p('name'),
    origin: p('origin'),
    target: p('target')
  });
  battle.render();
}
