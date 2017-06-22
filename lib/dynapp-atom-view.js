'use babel';

export default class WipAtomView {

  constructor(serializedState) {
    
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('testpackage');

    // Create message element
    const enter = document.createElement('button');
    enter.textContent = 'Enter';
    enter.onClick = function() {
      console.log("foo");
    }
    enter.classList.add('enter');
    this.element.appendChild(enter);
  }


  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove();
  }

  getElement() {
    return this.element;
  }

}
