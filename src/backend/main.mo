import Principal "mo:core/Principal";

actor {
  public query ({ caller }) func whoami() : async Principal {
    caller;
  };
};
