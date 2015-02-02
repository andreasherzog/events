Events = new Mongo.Collection("events");

if (Meteor.isClient) {

    Meteor.subscribe("events");

    Template.body.helpers({
        events: function () {
            if(Session.get("showOnlyMyEvents")){
                var user = Meteor.user();
                //filter events, exclude completed
                return Events.find({"attending": {"_id": user._id, "name": user.username}}, {sort: {eventDate: -1}});
            }
            //otherwise return all events
            return Events.find({}, {sort: {eventDate: -1}});
        },
        showOnlyMyEvents: function(){
            return Session.get("showOnlyMyEvents");
        },
        upcomingCount: function(){
            return Events.find({"eventDate": {"$gt": new Date()}}).count();
        },
        addNewEvent: function(){
            return Session.get("addNewEvent");
        }
    });

    Template.body.events({
        "change .hide-completed input": function (event) {
            Session.set("showOnlyMyEvents", event.target.checked);
        },
        "click .add-new-event": function(){
            Session.set("addNewEvent", true);
        }
    });

    Template.event.helpers({
      isOwner: function () {
        return this.owner === Meteor.userId();
      },
      view: function() {
          return Session.get('view-' + this._id);
      },
      isChecked: function() {
        var user = Meteor.user();
        if((this.attending? helpers.arrayObjectIndexOf(this.attending, user._id, "_id") : -1) == -1){
            return false;
        }
        else
            return true;
      },
      formatDate: function(date) {
        return moment(date).format('dddd, DD.MM.YYYY HH:mm');
      }
    });

    Template.event.events({
        "click .toggle-checked": function () {
          // Set the checked property to the opposite of its current value
          var ok = Meteor.call("setChecked", this._id);
          if(!ok) $("#" + this._id).attr('checked', false);
          else $("#" + this._id).attr('checked', true);
        },
        "click .delete": function () {
          Meteor.call("deleteEvent", this._id);
        },
        "click .toggle-private": function () {
          Meteor.call("setPrivate", this._id, ! this.private);
        },
        "click .event-item": function(event, item){
            Session.set('view-' + item.data._id, !Session.get('view-' + item.data._id));
        }
    });
    Template.datetimepicker.rendered = function(){
        $('.datetimepicker').datetimepicker();
    };
    Template.submitNewEvents.events({
        "keypress .new-event": function(event){
            Session.set("formitemChanged", true);
        },
        "click .cancel": function(event){
            $('.bootstrap-datetimepicker-widget').remove();
            form = $('#submitNewEvents');
            console.log(form);
            form.children().remove();
            UI.render(Template.submitNewEvents, form[0]);
            Session.set("formitemChanged", false);
            return false;
        },
        "submit form": function (event) {
            // This function is called when the new event form is submitted
            console.log(event.target);
            var text = event.target.text.value;
            var date = event.target.date.value;
            var description = event.target.description.value;

            console.log(text + " " + date + " " + description);

            Meteor.call("addEvent", text, description, date);

            // Clear form
            //event.target.text.value = "";

            // remove Buttons
            Session.set("formitemChanged", false);

            // Prevent default form submit
            return false;
        }
    });
    Template.updateButtons.helpers({
        formitemChanged: function(){
            return Session.get("formitemChanged");
        }
    });
    Accounts.ui.config({
      passwordSignupFields: "USERNAME_AND_EMAIL"
    });
}
helpers = {
    arrayObjectIndexOf: function (myArray, searchTerm, property) {
        for(var i = 0, len = myArray.length; i < len; i++) {
            if (myArray[i][property] === searchTerm) return i;
        }
        return -1;
    }
};
Meteor.methods({
  addEvent: function (text, description, date) {
    // Make sure the user is logged in before inserting a event
    if (! Meteor.userId()) {
      throw new Meteor.Error("not-authorized");
    }

    Events.insert({
      text: text,
      createdAt: new Date(),
      owner: Meteor.userId(),
      username: Meteor.user().username,
      description: description,
      eventDate: new Date(date)
    });
  },
  deleteEvent: function (eventId) {
    var event = Events.findOne(eventId);
    if (event.private && event.owner !== Meteor.userId()) {
      // If the event is private, make sure only the owner can delete it
      throw new Meteor.Error("not-authorized");
    }
    Events.remove(eventId);
  },
  setChecked: function (eventId) {
    var event = Events.findOne(eventId);
    var user = Meteor.user();
    var attending = event.attending? helpers.arrayObjectIndexOf(event.attending, user._id, "_id") : -1;
    if (event.private && event.owner !== Meteor.userId()) {
      // If the event is private, make sure only the owner can check it off
      throw new Meteor.Error("not-authorized");
    }
    if(event.eventDate < new Date() && attending == -1){
        alert('You cannot attend a past event');
        return false;
    }
    if(attending == -1){
        Events.update(eventId, { $push: { "attending": {"_id": user._id, "name": user.username}} });
        return true;
    }
    else{
        Events.update(eventId, {$pull: { "attending": {"_id": user._id, "name": user.username}}});
        return false;
    }
  },
  setPrivate: function (eventId, setToPrivate) {
      var event = Events.findOne(eventId);

      // Make sure only the event owner can make a event private
      if (event.owner !== Meteor.userId()) {
        throw new Meteor.Error("not-authorized");
      }

      Events.update(eventId, { $set: { private: setToPrivate } });
    }
});

if (Meteor.isServer) {
  Meteor.publish("events", function () {
    return Events.find({
        $or: [
          { private: {$ne: true} },
          { owner: this.userId }
        ]
  });
  });
}
