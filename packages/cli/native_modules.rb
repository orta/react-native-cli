def use_native_modules!(packages = nil)
  if (!packages)
    cli_bin = File.expand_path("../build/index.js", __FILE__)
    output = Pod::Executable.execute_command("node", [cli_bin, "config"], true)
    config = JSON.parse(output)
    packages = config["dependencies"]
  end

  found_pods = []

  packages.each do |package_name, package|
    next unless package["ios"]

    podspec_path = File.join(package["root"], package["ios"]["podspec"])
    spec = Pod::Specification.from_file(podspec_path)

    # We want to do a look up inside the current CocoaPods target
    # to see if it's already included, this:
    #   1. Gives you the chance to define it beforehand
    #   2. Ensures CocoaPods won't explode if it's included twice
    #
    this_target = current_target_definition
    existing_deps = current_target_definition.dependencies

    # Skip dependencies that the user already activated themselves.
    next if existing_deps.find do |existing_dep|
      existing_dep.name.split('/').first == spec.name
    end

    pod spec.name, :path => package["root"]

    if package["ios"]["scriptPhases"]
      # Can be either an object, or an array of objects
      Array(package["ios"]["scriptPhases"]).each do |phase|
        # see https://www.rubydoc.info/gems/cocoapods-core/Pod/Podfile/DSL#script_phase-instance_method
        # for the full object keys

        # Support passing in a path relative to the root of the package
        if phase["path"]
          phase["script"] = File.read(File.expand_path(phase["path"], package["root"]))
          phase.delete("path")
        end

        # Support converting the execution position into a symbol
        if phase["execution_position"]
          phase["execution_position"] = phase["execution_position"].to_sym
        end

        script_phase phase
      end
    end

    found_pods.push spec
  end

  if found_pods.size > 0
    pods = found_pods.map { |p| p.name }.sort.to_sentence
    Pod::UI.puts "Detected native module #{"pod".pluralize(found_pods.size)} for #{pods}"
  end
end

# You can run the tests for this file by running:
# $ ruby use_native_modules.rb
if $0 == __FILE__
  require "minitest/spec"
  require "minitest/autorun"

  # Define this here, because we’re not actually loading this code.
  module Pod
    class Specification
    end

    module UI
    end
  end

  # CocoaPods loads ActiveSupport, but we’re not doing that here just for the test.
  class Array
    def to_sentence
      size == 1 ? self[0] : "#{self[0..-2].join(", ")}, and #{self[-1]}"
    end
  end
  class String
    def pluralize(count)
      count == 1 ? self : "#{self}s"
    end
  end

  describe "use_native_modules!" do
    before do
      @script_phase = {
        "script" => "123",
        "name" => "My Name",
        "execution_position" => "before_compile",
        "input" => "string"
      }

      @ios_package = ios_package = {
        "root" => "/Users/grabbou/Repositories/WebViewDemoApp/node_modules/react",
        "ios" => {
          "podspec" => "React.podspec",
        },
        "android" => nil,
      }
      @android_package = {
        "root" => "/Users/grabbou/Repositories/WebViewDemoApp/node_modules/react-native-google-play-game-services",
        "ios" => nil,
        "android" => {
          # This is where normally more config would be
        }
      }
      @config = { "ios-dep" => @ios_package, "android-dep" => @android_package }

      @activated_pods = activated_pods = []
      @current_target_definition_dependencies = current_target_definition_dependencies = []
      @printed_messages = printed_messages = []
      @added_scripts = added_scripts = []
      @target_definition = target_definition = Object.new
      @podfile = podfile = Object.new
      @spec = spec = Object.new

      spec.singleton_class.send(:define_method, :name) { "ios-dep" }

      podfile.singleton_class.send(:define_method, :use_native_modules) do |config|
        use_native_modules!(config)
      end

      Pod::Specification.singleton_class.send(:define_method, :from_file) do |podspec_path|
        podspec_path.must_equal File.join(ios_package["root"], ios_package["ios"]["podspec"])
        spec
      end

      Pod::UI.singleton_class.send(:define_method, :puts) do |message|
        printed_messages << message
      end

      podfile.singleton_class.send(:define_method, :pod) do |name, options|
        activated_pods << { name: name, options: options }
      end

      podfile.singleton_class.send(:define_method, :script_phase) do |options|
        added_scripts << options
      end

      target_definition.singleton_class.send(:define_method, :dependencies) do
        current_target_definition_dependencies
      end

      podfile.singleton_class.send(:define_method, :current_target_definition) do
        target_definition
      end
    end

    it "activates iOS pods" do
      @podfile.use_native_modules(@config)
      @activated_pods.must_equal [{
        name: "ios-dep",
        options: { path: @ios_package["root"] }
      }]
    end

    it "does not activate pods that were already activated previously (by the user in their Podfile)" do
      activated_pod = Object.new
      activated_pod.singleton_class.send(:define_method, :name) { "ios-dep" }
      @current_target_definition_dependencies << activated_pod
      @podfile.use_native_modules(@config)
      @activated_pods.must_equal []
    end

    it "does not activate pods whose root spec were already activated previously (by the user in their Podfile)" do
      activated_pod = Object.new
      activated_pod.singleton_class.send(:define_method, :name) { "ios-dep/foo/bar" }
      @current_target_definition_dependencies << activated_pod
      @podfile.use_native_modules(@config)
      @activated_pods.must_equal []
    end

    it "prints out the native module pods that were found" do
      @podfile.use_native_modules({})
      @podfile.use_native_modules({ "pkg-1" => @ios_package })
      @podfile.use_native_modules({ "pkg-1" => @ios_package, "pkg-2" => @ios_package })
      @printed_messages.must_equal [
        "Detected native module pod for ios-dep",
        "Detected native module pods for ios-dep, and ios-dep"
      ]
    end

    describe "concerning script_phases" do
      it "uses the options directly" do
        @config["ios-dep"]["ios"]["scriptPhases"] = [@script_phase]
        @podfile.use_native_modules(@config)
        @added_scripts.must_equal [{
          "script" => "123",
          "name" => "My Name",
          "execution_position" => :before_compile,
          "input" => "string"
        }]
      end

      it "reads a script file relative to the package root" do
        @script_phase.delete("script")
        @script_phase["path"] = "./some_shell_script.sh"
        @config["ios-dep"]["ios"]["scriptPhases"] = [@script_phase]

        file_read_mock = MiniTest::Mock.new
        file_read_mock.expect(:call, "contents from file", [File.join(@ios_package["root"], "some_shell_script.sh")])

        File.stub(:read, file_read_mock) do
          @podfile.use_native_modules(@config)
        end

        @added_scripts.must_equal [{
          "script" => "contents from file",
          "name" => "My Name",
          "execution_position" => :before_compile,
          "input" => "string"
        }]
        file_read_mock.verify
      end
    end
  end
end