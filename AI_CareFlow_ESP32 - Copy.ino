#include "HX711.h"
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>

class BLESerialMock {
public:
  void begin(String name) {
    BLEDevice::init(name.c_str());
    BLEServer *pServer = BLEDevice::createServer();
    BLEService *pService = pServer->createService("4fafc201-1fb5-459e-8fcc-c5c9c331914b");
    pService->start();
    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID("4fafc201-1fb5-459e-8fcc-c5c9c331914b");
    pAdvertising->setScanResponse(true);
    BLEDevice::startAdvertising();
  }
  void print(const char* s) {}
  void print(float f, int d) {}
  void println(int i) {}
};

BLESerialMock SerialBT;

// ==========================================
// GLOBALS: LOAD CELL
// ==========================================
#define DT 27
#define SCK 26

HX711 scale;
float calibration_factor = 1121.0;
unsigned long lastUpdate = 0;
const int UPDATE_INTERVAL = 1000;
float current_weight = 0.00;

// ==========================================
// GLOBALS: BUTTON
// ==========================================
const int BUTTON_PIN = 25;
const int LONG_PRESS_TIME = 500;

int counter = 1;
bool lastButtonState = HIGH;
unsigned long pressedTime = 0;
bool isLongPressHandled = false;

// ==========================================
// GLOBALS: TOUCH SENSORS
// ==========================================
#define TOUCH_500ML 35
#define TOUCH_100ML 32

float full_weight = 0;
float low_weight = 0;
int selected_mode = 0;

// ==========================================
// SERIAL COMMUNICATION
// ==========================================
#define RXD2 16
#define TXD2 17

// ==========================================
// SETUP
// ==========================================
void setup() {

  Serial.begin(115200);

  // ESP32 TX2(GPIO17) -> Arduino Nano RX
  Serial2.begin(9600, SERIAL_8N1, RXD2, TXD2);

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(TOUCH_500ML, INPUT);
  pinMode(TOUCH_100ML, INPUT);

  scale.begin(DT, SCK);
  scale.tare();

  Serial.println("System Ready. Monitoring IV Drip...");

  // Initialize Bluetooth
  SerialBT.begin("AI_CareFlow_ESP32");
}

// ==========================================
// LOOP
// ==========================================
void loop() {

  // ----------------------------------------
  // Bottle Selection
  // ----------------------------------------
  if (digitalRead(TOUCH_500ML) == HIGH) {

    selected_mode = 1;

    scale.set_scale(calibration_factor);
    full_weight = scale.get_units(5);
    low_weight = full_weight * 0.2;

    Serial.println("Selected: 500ml bottle");
    Serial.print("Full weight: ");
    Serial.println(full_weight);
    Serial.print("Low Level (20%): ");
    Serial.println(low_weight);

    delay(500);
  }

  if (digitalRead(TOUCH_100ML) == HIGH) {

    selected_mode = 2;

    scale.set_scale(calibration_factor);
    full_weight = scale.get_units(5);
    low_weight = full_weight * 0.2;

    Serial.println("Selected: 100ml bottle");
    Serial.print("Full weight: ");
    Serial.println(full_weight);
    Serial.print("Low Level (20%): ");
    Serial.println(low_weight);

    delay(500);
  }

  // ----------------------------------------
  // Button Logic
  // ----------------------------------------
  bool currentButtonState = digitalRead(BUTTON_PIN);

  if (lastButtonState == HIGH && currentButtonState == LOW) {
    pressedTime = millis();
    isLongPressHandled = false;
    delay(20);
  }

  if (currentButtonState == LOW && !isLongPressHandled) {
    if (millis() - pressedTime > LONG_PRESS_TIME) {
      if (counter > 1) {
        counter--;
      }
      isLongPressHandled = true;
    }
  }

  if (lastButtonState == LOW && currentButtonState == HIGH) {
    if (!isLongPressHandled) {
      counter++;
    }
    delay(20);
  }

  lastButtonState = currentButtonState;

  // ----------------------------------------
  // Weight Monitoring
  // ----------------------------------------
  if (millis() - lastUpdate >= UPDATE_INTERVAL) {

    lastUpdate = millis();

    scale.set_scale(calibration_factor);
    current_weight = scale.get_units(5);

    // Remove small noise
    if (current_weight > -1.0 && current_weight < 1.0) {
      current_weight = 0.0;
    }

    // ----------------------------------------
    // LOW LEVEL DETECTION
    // ----------------------------------------
    if (selected_mode != 0) {

      if (current_weight <= low_weight) {

        Serial.println("LOW LEVEL REACHED - STOP FLOW");

        // Send OFF command to Arduino Nano
        Serial2.println("OFF");

        Serial.println("OFF command sent to Arduino");
      }
    }

    // ----------------------------------------
    // Display
    // ----------------------------------------
    Serial.print("Weight: ");
    Serial.print(current_weight, 1);
    Serial.print(" g || Drips: ");
    Serial.println(counter);

    // Send data over Bluetooth
    SerialBT.print("Weight: ");
    SerialBT.print(current_weight, 1);
    SerialBT.print(" g || Drips: ");
    SerialBT.println(counter);
  }
}