/* jshint esversion:6 */

////////////////
// Constants //
//////////////

const MAKE_AN_ATTACK = 'makeAttack';
const CANCEL_AN_ATTACK = 'cancelAttack';
const PHYSIC_ATTACK = 'physic';
const MAGIC_ATTACK = 'magic';

/////////////////
// Definition //
///////////////

const hero = {
  name: 'Hero',
  level: 1,
  hp: 100,
  mp: 20,
  characts: {
    strengh: 10,
    constitution: 10,
    magic: 10,
    spirit: 10,
    luck: 5,
    speed: 10
  },
  attacks: [{
    cost: 0,
    damage: 10,
    loading: 1,
    name: 'Kick',
    origin: 'hero',
    target: 'monster',
    type: PHYSIC_ATTACK
  }, {
    cost: 5,
    damage: 50,
    loading: 5,
    name: 'H20',
    origin: 'hero',
    target: 'monster',
    type: MAGIC_ATTACK
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

// render :: (string, string) -> void
function render(domId, content) {
  const parser = new DOMParser();
  const doc = R.path(['body', 'innerHTML'], parser.parseFromString(content, 'text/html'));
  const domElements = document.querySelectorAll(domId);

  R.forEach(cur => cur.innerHTML = doc, domElements);
}

// template :: (function, array) -> string
function template(view, list) {
  const mapIndexed = R.addIndex(R.map);

  return R.join('', mapIndexed(view, list));
}

// datasetTransform :: object -> object
function datasetTransform(dataset) {
  const transformations = {
    cost: Number,
    damage: Number,
    loading: Number
  };

  return R.evolve(transformations, dataset);
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
      characts: {
        strengh: 100,
        constitution: 100,
        magic: 100,
        spirit: 5,
        luck: 5,
        speed: 10
      },
      attacks: [{
        cost: 0,
        damage: 10,
        loading: 1,
        name: 'Claw',
        origin: 'monster',
        target: 'hero',
        type: PHYSIC_ATTACK
      }, {
        cost: 12,
        damage: 50,
        loading: 8,
        name: 'Fire breath',
        origin: 'monster',
        target: 'hero',
        type: MAGIC_ATTACK
      }],
      stack: [],
      currentAttack: null
    }
  };

  return {
    canAttack: (who, cost) => (store[who].mp - cost >= 0) ? true : false,
    loadAttack: (attack) => {
      // Add new attack in the stack
      store[attack.origin].stack.push(attack);
      // Start loading the attack if their is no current attack loading
      if (R.isNil(store[attack.origin].currentAttack)) {
        store[attack.origin].currentAttack = asyncAttack(attack.loading, {
          attack,
          hero: store.hero.characts,
          monster: store.monster.characts
        });
      }
    },
    loseMP: (toWho, amount) => store[toWho].mp -= amount,
    loseHP: (toWho, amount) => store[toWho].hp -= amount,
    nextAttack: (who) => {
      // Remove the attack that finished
      store[who].stack.splice(0, 1);
      // Start loading the next attack if the stack is not empty
      if (!R.isEmpty(store[who].stack)) {
        const nextAttack = R.head(store[who].stack);
        store[who].currentAttack = asyncAttack(nextAttack.loading, {
          attack: nextAttack,
          hero: store.hero.characts,
          monster: store.monster.characts
        });
      }
    },
    removeAttackFromStack: (who, indexInStack) => store[who].stack.splice(indexInStack, 1),
    render: () => render('#battle', template(fighterView, [store.hero, store.monster])),
    restoreMP: (toWho, amount) => store[toWho].mp += amount,
    stack: (who) => store[who].stack,
    store: () => store,
    currentAttack: (who, value = undefined) => {
      if (!R.equals(value, undefined)) {
        store[who].currentAttack = value;
      }
      return store[who].currentAttack;
    }
  };
}

// loadingToMillisec :: number -> number
function loadingToMillisec(loading) {
  return R.multiply(loading, 1000);
}

// removeAttackFromStack :: object -> void
function removeAttackFromStack(attack) {
  const p = R.prop(R.__, attack);

  battle.restoreMP(p('origin'), p('cost'));
  battle.removeAttackFromStack(p('origin'), p('stackIndex'));
  battle.render();
}

// asyncAttack :: (number, object) -> number
function asyncAttack(delay, params) {
  return window.setTimeout(applyAttack, loadingToMillisec(delay), params);
}

// applyAttack :: object -> void
function applyAttack(attack) {
  const p = R.path(R.__, attack);
  let damages = 0;

  if (R.equals(p(['attack', 'origin']), 'hero')) {
    damages = calculateDamage(p(['attack']), p(['hero']), p(['monster']));
  } else {
    damages = calculateDamage(p(['attack']), p(['monster']), p(['hero']));
  }

  battle.loseHP(p(['attack', 'target']), damages);
  battle.currentAttack(p(['attack', 'origin']), null);
  battle.nextAttack(p(['attack', 'origin']));
  battle.render();
}

function calculateDamage(attack, origin, target) {
  const o = R.prop(R.__, origin);
  const t = R.prop(R.__, target);

  return R.ifElse(
    attack => R.equals(R.prop('type', attack), PHYSIC_ATTACK),
    attack => R.compose(
      Math.trunc,
      R.divide(R.__, t('constitution')),
      R.multiply(o('strengh'))
    )(R.prop('damage', attack)),
    attack => R.compose(
      Math.trunc,
      R.divide(R.__, t('spirit')),
      R.multiply(o('magic'))
    )(R.prop('damage', attack))
  )(attack);
}

// loadAttack :: object -> void
function loadAttack(attack) {
  const p = R.prop(R.__, attack);

  battle.loseMP(p('origin'), p('cost'));
  battle.loadAttack(attack);
  battle.render();
}


////////////
// Views //
//////////


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
            data-function-identifier="${MAKE_AN_ATTACK}"
            data-loading="${p('loading')}"
            data-name="${p('name')}"
            data-origin="${p('origin')}"
            data-target="${p('target')}"
            data-type="${p('type')}"
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
              data-function-identifier="${CANCEL_AN_ATTACK}"
              data-origin="${p('origin')}"
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

/////////////
// Events //
///////////

// registerEvents :: [object] -> void
function registerEvents(listOfEvents) {
  return R.forEach(cur => {
    const p = R.prop(R.__, cur);
    document.body.addEventListener(p('type'), p('funct'), false);
  }, listOfEvents);
}

// registerAttack :: DOM event -> void
function registerAttack(event) {
  const p = R.prop(R.__, datasetTransform(R.path(['target', 'dataset'], event)));

  if (R.equals(p('functionIdentifier'), MAKE_AN_ATTACK)) {
    loadAttack({
      cost: p('cost'),
      damage: p('damage'),
      loading: p('loading'),
      name: p('name'),
      origin: p('origin'),
      target: p('target'),
      type: p('type')
    });
  }
}

// cancelAttack :: DOM event -> void
function cancelAttack(event) {
  const p = R.prop(R.__, datasetTransform(R.path(['target', 'dataset'], event)));

  if (R.equals(p('functionIdentifier'), CANCEL_AN_ATTACK)) {
    removeAttackFromStack({
      cost: p('cost'),
      stackIndex: p('stackIndex'),
      origin: p('origin'),
    });
  }
}
