#!/usr/bin/env python
# -*- coding: utf-8 -*-
# PYTHON CHEATSHEET

import logging
import sys
#import yaml
import json
import urllib2
from math import pi
import re

class MyClass():
    def __init__(self):
        pass
    def someFunc(self, argument):
        """ THis is a docstring
        """
        self.oneInstanceVar = 'foo'
        self.someFunc() # Call another instance function

    def stringOps(self):
        my_string = 'hello there'
        my_string[4] # SHows the 4th char
        string_list = my_string.split(' ')
        joined_string = ' '.join(string_list)
        print("foo %s bar: %s" % string_list[0], string_list[1])
        # Alternate interpolation syntax
        print("foo {} bar {}".format(string_list[0], string_list[1]))
    def dsOps(self):
        """ Working with lists and dicts """
        mylist = ['spam', 'eggs', 100, 200] # Creates a list
        idx = 1
        mylist.insert(idx,"foo")
        mylist.remove("item value")
        del mylist[idx]
        mylist.pop(idx) # Returns item in 'idx' pos, or last item
        mylist.index('item_value')
        mylist.count('item_value')
        mylist.sort()
        mylist.reverse()
        len(mylist)
        [mylist[-1], mylist[:-2]] # last item, all but last two items
        mylist.append(5,6) # 1,2,3,4,[5,6]
        mylist.extend(5,6) # 1,2,3,4,5,6
        """ Dicts / Dictionary operations """
        tel = {'aj': 1234, 'jk': 5678}
        dict([('foo', 1234),('bar', 5678)])
        tel.has_key('aj')
        tel.keys()
        tel.items()
    def conditionalsAndLoops(self):
        """ Some conditionals examples, and some loops
            uses 'if', 'elif', 'else'.
            'break' breaks out of loops, 'continue' short-circuts
            'while' can be used for loops',
        """
        for i in range(21):
            pass
        knights={'f':1,'g':2}
        for k,v in knights.items() :
            print(k,v)
        my_list=[1,2,3,4]
        for idx,value in enumerate(my_list):
            print(idx,value)

    def fileIO(self):
        """ Reading and writig to files """
        x = int(input("Please enter an integer:"))
        [ sys.argv[0], sys.argv[1]] # ['prodname', 'first-arg']
        # see better arg parsing
        # non-enclosure
        fh = open('foo','w')
        fh.write('hi there')
        fh.close()
        # closure method
        with open('foo','r') as fh:
            num_bytes=10
            fh.read(num_bytes)
            fh.readline() # A line string
            fh.readline() # a list of strings

    def usingYamlAndJson(self):
        """ Conventions.. safe_load, load, dump operates on
            file handles.. loads/dumps operates with strings
        """
        with open('some_datafile','rw') as fh:
            #myData = yaml.safe_load(fh)
            #yaml.dump(myData,fh)
            fh.reset()
            myData = json.load(fh)
            json.dump(myData,fh)

        response = urllib2.open("http://www.google.com/")
        html = response.read()

    def lambdas(self):
        def make_incrementer(n):
            return lambda x: x+n
        f = make_incrementer(42)
        f(0); f(1) # $2, then 43

    def comprehensions(self):
        """ Using Comprehensions """
        squares = [x**2 for x in range(10)]
        [x for x in squares if x >= 0]
        [str(round(pi, i)) for i in range(1, 6)]
        {x: x**2 for x in (2,4,6)} # Dict creation via comp.

    def someOtherOps(self):
        os.path.isfile('some_file')
        os.path.exists('some_file')
        os.makedirs('new_dir')
        re.search(r'^First','First Line OPf FIle') # returns match obj

        try:
            raise Exception('oops!')
        except Exception as e:
            print("Something happened {}".format(e))
        finally:
            'this_always_happens'


if __name__ == '__main__':
    print('This script is being run directly')
    myInstance = MyClass()
    myInstance.lambdas()
    dir(myInstance)
